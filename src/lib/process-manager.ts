import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { ClaudeOutput } from '@/types';
import { getSystemPrompt } from './system-prompt';

interface ProcessInstance {
  child: ChildProcess;
  attemptId: string;
  buffer: string;
  startedAt: number;
}

interface ProcessEvents {
  json: (data: { attemptId: string; data: ClaudeOutput }) => void;
  raw: (data: { attemptId: string; content: string }) => void;
  stderr: (data: { attemptId: string; content: string }) => void;
  exit: (data: { attemptId: string; code: number | null }) => void;
}

/**
 * ProcessManager - Singleton class to manage Claude Code CLI processes
 * Handles spawning, output streaming, and lifecycle management
 */
class ProcessManager extends EventEmitter {
  private processes = new Map<string, ProcessInstance>();

  constructor() {
    super();
    // Cleanup on process exit
    process.on('exit', () => this.killAll());
    process.on('SIGINT', () => this.killAll());
    process.on('SIGTERM', () => this.killAll());
  }

  /**
   * Spawn a new Claude Code CLI process using 'script' command for TTY emulation
   * @param sessionId - Optional session ID to resume a previous conversation
   * @param filePaths - Optional array of file paths to include via @file syntax
   */
  spawn(attemptId: string, projectPath: string, prompt: string, sessionId?: string, filePaths?: string[]): void {
    if (this.processes.has(attemptId)) {
      console.warn(`Process ${attemptId} already exists`);
      return;
    }

    console.log(`[ProcessManager] Spawning Claude for attempt ${attemptId}`);
    console.log(`[ProcessManager] Project path: ${projectPath}`);
    console.log(`[ProcessManager] Prompt: ${prompt.substring(0, 100)}...`);
    if (sessionId) {
      console.log(`[ProcessManager] Resuming session: ${sessionId}`);
    }

    // Auto-detect Claude path or use CLAUDE_PATH env var
    let claudePath = process.env.CLAUDE_PATH;

    if (!claudePath) {
      // Try common paths in order of likelihood
      const commonPaths = [
        '/home/roxane/.local/bin/claude',  // Ubuntu/Linux
        '/usr/local/bin/claude',           // Linux system-wide
        '/opt/homebrew/bin/claude',        // macOS
        '/opt/homebrew/bin/claude',        // macOS (alternative)
      ];

      const { existsSync } = require('fs');
      claudePath = commonPaths.find((p) => existsSync(p));
    }

    if (!claudePath) {
      // No Claude found - emit error with instructions
      const errorMsg = [
        'Claude CLI not found. Please set CLAUDE_PATH in your .env file:',
        '',
        '# Linux/Ubuntu:',
        'CLAUDE_PATH=/home/$(whoami)/.local/bin/claude',
        '',
        '# macOS (Homebrew):',
        'CLAUDE_PATH=/opt/homebrew/bin/claude',
        '',
        '# Or the full path to your claude binary',
      ].join('\n');
      this.emit('stderr', { attemptId, content: errorMsg });
      this.emit('exit', { attemptId, code: 1 });
      return;
    }

    // Get formatting instructions to append to prompt (safe - doesn't override Claude's core system prompt)
    const formatInstructions = getSystemPrompt(projectPath);

    // Combine user prompt with format instructions
    const fullPrompt = `${prompt}\n\n<output-format-guidelines>\n${formatInstructions}\n</output-format-guidelines>`;

    // Build args array for spawn
    const args: string[] = [];

    // Add file references first (before -p flag)
    if (filePaths && filePaths.length > 0) {
      for (const fp of filePaths) {
        args.push(`@${fp}`);
      }
    }

    // Add prompt
    args.push('-p', fullPrompt);

    // Add required flags
    args.push('--output-format', 'stream-json');
    args.push('--verbose');
    args.push('--dangerously-skip-permissions');

    // Add session resume if provided
    if (sessionId) {
      args.push('--resume', sessionId);
    }

    console.log(`[ProcessManager] Spawning:`, claudePath, 'with', args.length, 'args');

    // Spawn Claude - ignore stdin to prevent blocking (AskUserQuestion handled separately)
    const child = spawn(claudePath, args, {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        TERM: 'dumb',
        PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin`,
      },
    });

    console.log(`[ProcessManager] Process spawned with PID: ${child.pid}`);

    const instance: ProcessInstance = {
      child,
      attemptId,
      buffer: '',
      startedAt: Date.now(),
    };

    this.processes.set(attemptId, instance);

    // End stdin to signal we're not sending more input (unless AskUserQuestion needs it later)
    // Note: For AskUserQuestion, we'll need to keep stdin open - handled by sendInput method
    // For now, don't close stdin so interactive responses can work

    // Handle stdout
    child.stdout?.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      console.log(`[ProcessManager] stdout (${attemptId}):`, data.substring(0, 200));
      this.handleOutput(instance, data);
    });

    // Handle stderr
    child.stderr?.on('data', (chunk: Buffer) => {
      const content = chunk.toString();
      console.log(`[ProcessManager] stderr (${attemptId}):`, content.substring(0, 200));
      this.emit('stderr', { attemptId, content });
    });

    // Handle exit
    child.on('exit', (code) => {
      console.log(`[ProcessManager] Process ${attemptId} exited with code: ${code}`);
      // Flush remaining buffer
      if (instance.buffer.trim()) {
        this.processLine(instance, instance.buffer);
      }
      this.processes.delete(attemptId);
      this.emit('exit', { attemptId, code });
    });

    // Handle errors
    child.on('error', (error) => {
      console.error(`[ProcessManager] Process ${attemptId} error:`, error);
      this.emit('stderr', { attemptId, content: error.message });
      this.emit('exit', { attemptId, code: 1 });
      this.processes.delete(attemptId);
    });
  }

  /**
   * Handle stdout output - buffer and parse JSON lines
   */
  private handleOutput(instance: ProcessInstance, chunk: string): void {
    instance.buffer += chunk;

    // Process complete lines
    const lines = instance.buffer.split('\n');
    instance.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      this.processLine(instance, line);
    }
  }

  /**
   * Process a single line of output
   */
  private processLine(instance: ProcessInstance, line: string): void {
    try {
      const data = JSON.parse(line) as ClaudeOutput;
      this.emit('json', { attemptId: instance.attemptId, data });
    } catch {
      // Non-JSON output - emit as raw
      this.emit('raw', { attemptId: instance.attemptId, content: line });
    }
  }

  /**
   * Send input to process stdin (for interactive responses like AskUserQuestion)
   * NOTE: Currently stdin is ignored to prevent blocking. Interactive responses
   * will need to be handled differently (e.g., via API or separate process).
   */
  sendInput(attemptId: string, input: string): boolean {
    const instance = this.processes.get(attemptId);
    if (!instance) return false;

    // stdin is currently ignored - log warning
    console.warn(`[ProcessManager] sendInput called but stdin is ignored for ${attemptId}`);
    console.log(`[ProcessManager] Input was: ${input.substring(0, 100)}...`);
    return false;
  }

  /**
   * Send interrupt signal to process (like Ctrl+C)
   */
  interrupt(attemptId: string): boolean {
    const instance = this.processes.get(attemptId);
    if (!instance) return false;

    instance.child.kill('SIGINT');
    return true;
  }

  /**
   * Kill process immediately
   */
  kill(attemptId: string): boolean {
    const instance = this.processes.get(attemptId);
    if (!instance) return false;

    instance.child.kill('SIGTERM');
    this.processes.delete(attemptId);
    return true;
  }

  /**
   * Kill all running processes
   */
  killAll(): void {
    for (const [attemptId, instance] of this.processes) {
      instance.child.kill('SIGTERM');
      this.processes.delete(attemptId);
    }
  }

  /**
   * Check if a process is running
   */
  isRunning(attemptId: string): boolean {
    return this.processes.has(attemptId);
  }

  /**
   * Get running process count
   */
  get runningCount(): number {
    return this.processes.size;
  }

  /**
   * Get all running attempt IDs
   */
  getRunningAttempts(): string[] {
    return Array.from(this.processes.keys());
  }

  // Type-safe event emitter methods
  override on<K extends keyof ProcessEvents>(
    event: K,
    listener: ProcessEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof ProcessEvents>(
    event: K,
    ...args: Parameters<ProcessEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

// Export singleton instance
export const processManager = new ProcessManager();
