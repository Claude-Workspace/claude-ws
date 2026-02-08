import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import type { ClaudeOutput } from '../types';
import { getSystemPrompt } from './system-prompt';
import { createLogger } from './logger';

const log = createLogger('ProcessManager');

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
 *
 * Note: AskUserQuestion tool is handled by continuing the conversation
 * with --resume when user provides their answer.
 */
class ProcessManager extends EventEmitter {
  private processes = new Map<string, ProcessInstance>();

  constructor() {
    super();
    // Cleanup on process exit (SIGINT/SIGTERM handled by server.ts)
    process.on('exit', () => this.killAll());
  }

  /**
   * Spawn a new Claude Code CLI process
   * @param sessionId - Optional session ID to resume a previous conversation
   * @param filePaths - Optional array of file paths to include via @file syntax
   */
  spawn(attemptId: string, projectPath: string, prompt: string, sessionId?: string, filePaths?: string[]): void {
    if (this.processes.has(attemptId)) {
      log.warn({ attemptId }, 'Process already exists');
      return;
    }

    log.info({ attemptId, projectPath, promptLength: prompt.length }, 'Spawning Claude process');
    if (sessionId) {
      log.info({ attemptId, sessionId }, 'Resuming session');
    }

    // Auto-detect Claude path or use CLAUDE_PATH env var
    let claudePath = process.env.CLAUDE_PATH;

    if (!claudePath) {
      const commonPaths = [
        '/home/roxane/.local/bin/claude',
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
      ];
      claudePath = commonPaths.find(p => existsSync(p));
    }

    if (!claudePath) {
      const errorMsg = [
        'Claude CLI not found. Please set CLAUDE_PATH in your .env file:',
        '',
        '# Linux/Ubuntu:',
        'CLAUDE_PATH=/home/$(whoami)/.local/bin/claude',
        '',
        '# macOS (Homebrew):',
        'CLAUDE_PATH=/opt/homebrew/bin/claude',
      ].join('\n');
      this.emit('stderr', { attemptId, content: errorMsg });
      this.emit('exit', { attemptId, code: 1 });
      return;
    }

    // Get formatting instructions to append to prompt
    const formatInstructions = getSystemPrompt(projectPath);
    const fullPrompt = `${prompt}\n\n<output-format-guidelines>\n${formatInstructions}\n</output-format-guidelines>`;

    // Build args array
    const args: string[] = [];

    // Add file references first
    if (filePaths && filePaths.length > 0) {
      for (const fp of filePaths) {
        args.push(`@${fp}`);
      }
    }

    // Add prompt and flags
    args.push('-p', fullPrompt);
    args.push('--output-format', 'stream-json');
    args.push('--verbose');
    args.push('--dangerously-skip-permissions');

    if (sessionId) {
      args.push('--resume', sessionId);
    }

    log.info({ claudePath, argsCount: args.length }, 'Spawning process');

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

    log.info({ attemptId, pid: child.pid }, 'Process spawned');

    const instance: ProcessInstance = {
      child,
      attemptId,
      buffer: '',
      startedAt: Date.now(),
    };

    this.processes.set(attemptId, instance);

    // Handle stdout
    child.stdout?.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      log.debug({ attemptId, dataPreview: data.substring(0, 200) }, 'stdout received');
      this.handleOutput(instance, data);
    });

    // Handle stderr
    child.stderr?.on('data', (chunk: Buffer) => {
      const content = chunk.toString();
      log.debug({ attemptId, contentPreview: content.substring(0, 200) }, 'stderr received');
      this.emit('stderr', { attemptId, content });
    });

    // Handle exit
    child.on('exit', (code) => {
      log.info({ attemptId, code }, 'Process exited');
      if (instance.buffer.trim()) {
        this.processLine(instance, instance.buffer);
      }
      this.processes.delete(attemptId);
      this.emit('exit', { attemptId, code });
    });

    // Handle errors
    child.on('error', (error) => {
      log.error({ attemptId, error }, 'Process error');
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

    const lines = instance.buffer.split('\n');
    instance.buffer = lines.pop() || '';

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
      this.emit('raw', { attemptId: instance.attemptId, content: line });
    }
  }

  /**
   * Send input to process stdin
   * Returns false since stdin is ignored (answers handled via --resume)
   */
  sendInput(attemptId: string, input: string): boolean {
    const instance = this.processes.get(attemptId);
    if (!instance) {
      return false;  // Process not running
    }
    // stdin is ignored, return false to trigger continuation attempt
    return false;
  }

  /**
   * Send interrupt signal (Ctrl+C)
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
