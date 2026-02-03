/**
 * Shell Manager - Manages background shell processes per project
 *
 * Follows AgentManager pattern with EventEmitter for Socket.io forwarding.
 * Shells belong to projects (not tasks), persist across task switches.
 */

import { EventEmitter } from 'events';
import { spawn, type ChildProcess } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { nanoid } from 'nanoid';
import { createLogBuffer, type LogBuffer, type LogEntry } from './circular-buffer';

export interface ShellInstance {
  shellId: string;
  projectId: string;
  attemptId: string;
  command: string;
  args: string[];
  cwd: string;
  process: ChildProcess;
  pid: number;
  logBuffer: LogBuffer;
  startedAt: number;
  exitCode: number | null;
  exitSignal: string | null;
  logFile?: string; // For external processes, output goes to this file
}

interface ShellEvents {
  started: (data: { shellId: string; projectId: string; pid: number; command: string }) => void;
  output: (data: { shellId: string; projectId: string; type: 'stdout' | 'stderr'; content: string }) => void;
  exit: (data: { shellId: string; projectId: string; code: number | null; signal: string | null }) => void;
}

export interface ShellStartOptions {
  projectId: string;
  attemptId: string;
  command: string;
  cwd: string;
  description?: string;
}

export interface ShellInfo {
  shellId: string;
  projectId: string;
  attemptId: string;
  command: string;
  pid: number;
  startedAt: number;
  isRunning: boolean;
  exitCode: number | null;
}

/**
 * ShellManager - Singleton class to manage background shell processes
 */
class ShellManager extends EventEmitter {
  private shells = new Map<string, ShellInstance>();

  constructor() {
    super();
    // Note: We do NOT cleanup shells on SIGINT/SIGTERM
    // Background shells are meant to persist across server restarts
    // Only cleanup on hard exit (process.exit())
    process.on('exit', () => {
      // Log shells that will continue running
      const running = this.runningCount;
      if (running > 0) {
        console.log(`[ShellManager] Server exiting, ${running} shells will continue running independently`);
      }
    });
  }

  /**
   * Spawn a new background shell process
   */
  spawn(options: ShellStartOptions): string {
    const { projectId, attemptId, command, cwd } = options;
    const shellId = nanoid();

    console.log(`[ShellManager] Spawning shell ${shellId} in ${cwd}`);
    console.log(`[ShellManager] Command: ${command}`);

    // Parse command - use shell to handle complex commands
    // detached: true creates new process group, shell survives if parent dies
    const child = spawn('bash', ['-c', command], {
      cwd,
      shell: false, // We're already using bash -c
      detached: true, // Detach - shell survives server/session restart
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Unref to allow parent to exit independently (shell continues running)
    child.unref();

    if (!child.pid) {
      console.error(`[ShellManager] Failed to spawn process for shell ${shellId}`);
      throw new Error(`Failed to spawn process: ${command}`);
    }

    const instance: ShellInstance = {
      shellId,
      projectId,
      attemptId,
      command,
      args: ['-c', command],
      cwd,
      process: child,
      pid: child.pid,
      logBuffer: createLogBuffer(1000),
      startedAt: Date.now(),
      exitCode: null,
      exitSignal: null,
    };

    this.shells.set(shellId, instance);

    // Setup output handlers
    child.stdout?.on('data', (data: Buffer) => {
      const content = data.toString();
      const entry: LogEntry = {
        type: 'stdout',
        content,
        timestamp: Date.now(),
      };
      instance.logBuffer.push(entry);
      this.emit('output', { shellId, projectId, type: 'stdout', content });
    });

    child.stderr?.on('data', (data: Buffer) => {
      const content = data.toString();
      const entry: LogEntry = {
        type: 'stderr',
        content,
        timestamp: Date.now(),
      };
      instance.logBuffer.push(entry);
      this.emit('output', { shellId, projectId, type: 'stderr', content });
    });

    // Handle process exit
    child.on('exit', (code, signal) => {
      console.log(`[ShellManager] Shell ${shellId} exited with code ${code}, signal ${signal}`);
      instance.exitCode = code;
      instance.exitSignal = signal;
      this.emit('exit', { shellId, projectId, code, signal });
    });

    // Handle spawn errors
    child.on('error', (error) => {
      console.error(`[ShellManager] Shell ${shellId} error:`, error);
      const entry: LogEntry = {
        type: 'stderr',
        content: `Process error: ${error.message}`,
        timestamp: Date.now(),
      };
      instance.logBuffer.push(entry);
      this.emit('output', { shellId, projectId, type: 'stderr', content: `Process error: ${error.message}` });
    });

    // Emit started event
    this.emit('started', { shellId, projectId, pid: child.pid, command });

    console.log(`[ShellManager] Shell ${shellId} started with PID ${child.pid}`);

    return shellId;
  }

  /**
   * Stop a running shell process
   */
  stop(shellId: string, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    const instance = this.shells.get(shellId);
    if (!instance) {
      console.warn(`[ShellManager] Shell ${shellId} not found`);
      return false;
    }

    if (instance.exitCode !== null) {
      console.warn(`[ShellManager] Shell ${shellId} already exited`);
      return false;
    }

    // External processes (tracked via BGPID) aren't process group leaders
    // Use direct PID kill for them, process group kill (-pid) for our spawned shells
    const isExternalProcess = !instance.process;
    const killTarget = isExternalProcess ? instance.pid : -instance.pid;

    console.log(`[ShellManager] Stopping shell ${shellId} (PID ${instance.pid}, external: ${isExternalProcess}) with ${signal}`);

    try {
      process.kill(killTarget, signal);

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (instance.exitCode === null && this.isPidAlive(instance.pid)) {
          console.log(`[ShellManager] Force killing shell ${shellId}`);
          try {
            process.kill(killTarget, 'SIGKILL');
          } catch {
            // Process might already be dead
          }
        }
      }, 5000);

      // For external/restored shells, manually emit exit event since we can't listen to process events
      if (isExternalProcess) {
        // Check if process actually died
        setTimeout(() => {
          if (!this.isPidAlive(instance.pid)) {
            instance.exitCode = 0; // Assume success
            instance.exitSignal = signal;
            this.emit('exit', {
              shellId,
              projectId: instance.projectId,
              code: 0,
              signal,
            });
          }
        }, 500);
      }

      return true;
    } catch (error) {
      console.error(`[ShellManager] Failed to stop shell ${shellId}:`, error);
      return false;
    }
  }

  /**
   * Get shell instance by ID
   */
  getShell(shellId: string): ShellInstance | undefined {
    return this.shells.get(shellId);
  }

  /**
   * Get all shells for a project
   */
  getShellsByProject(projectId: string): ShellInstance[] {
    return Array.from(this.shells.values()).filter(s => s.projectId === projectId);
  }

  /**
   * Get shell info for API/client
   */
  getShellInfo(shellId: string): ShellInfo | undefined {
    const shell = this.shells.get(shellId);
    if (!shell) return undefined;

    return {
      shellId: shell.shellId,
      projectId: shell.projectId,
      attemptId: shell.attemptId,
      command: shell.command,
      pid: shell.pid,
      startedAt: shell.startedAt,
      isRunning: shell.exitCode === null,
      exitCode: shell.exitCode,
    };
  }

  /**
   * Get all shell infos for a project
   */
  getShellInfosByProject(projectId: string): ShellInfo[] {
    return this.getShellsByProject(projectId).map(s => ({
      shellId: s.shellId,
      projectId: s.projectId,
      attemptId: s.attemptId,
      command: s.command,
      pid: s.pid,
      startedAt: s.startedAt,
      isRunning: s.exitCode === null,
      exitCode: s.exitCode,
    }));
  }

  /**
   * Get recent logs from a shell
   * For external processes with logFile, reads from the file
   */
  getRecentLogs(shellId: string, lines: number = 100): LogEntry[] {
    const shell = this.shells.get(shellId);
    if (!shell) return [];

    // For external processes, try reading from log file
    if (shell.logFile && existsSync(shell.logFile)) {
      try {
        const content = readFileSync(shell.logFile, 'utf-8');
        const logLines = content.split('\n').slice(-lines);
        return logLines.map(line => ({
          type: 'stdout' as const,
          content: line,
          timestamp: Date.now(),
        }));
      } catch (err) {
        console.warn(`[ShellManager] Failed to read log file ${shell.logFile}:`, err);
      }
    }

    return shell.logBuffer.getLast(lines);
  }

  /**
   * Check if a shell is running
   */
  isRunning(shellId: string): boolean {
    const shell = this.shells.get(shellId);
    return shell ? shell.exitCode === null : false;
  }

  /**
   * Get count of running shells
   */
  get runningCount(): number {
    return Array.from(this.shells.values()).filter(s => s.exitCode === null).length;
  }

  /**
   * Get all shell IDs
   */
  getAllShellIds(): string[] {
    return Array.from(this.shells.keys());
  }

  /**
   * Remove a stopped shell from tracking
   */
  remove(shellId: string): boolean {
    const shell = this.shells.get(shellId);
    if (!shell) return false;

    // Only remove if already exited
    if (shell.exitCode === null) {
      console.warn(`[ShellManager] Cannot remove running shell ${shellId}`);
      return false;
    }

    this.shells.delete(shellId);
    return true;
  }

  /**
   * Check if a PID is still running
   */
  isPidAlive(pid: number): boolean {
    try {
      // Signal 0 doesn't kill the process, just checks if it exists
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Track an external process by PID (e.g., from nohup background command)
   * Used when Claude spawns processes via bash that we want to track/kill
   */
  trackExternalProcess(options: {
    projectId: string;
    attemptId: string;
    command: string;
    cwd: string;
    pid: number;
    logFile?: string;
  }): string | null {
    const { projectId, attemptId, command, cwd, pid, logFile } = options;

    // Verify PID is alive
    if (!this.isPidAlive(pid)) {
      console.log(`[ShellManager] Cannot track PID ${pid}: not running`);
      return null;
    }

    const shellId = nanoid();
    console.log(`[ShellManager] Tracking external process ${shellId} with PID ${pid}`);

    const instance: ShellInstance = {
      shellId,
      projectId,
      attemptId,
      command,
      args: ['-c', command],
      cwd,
      process: null as unknown as ChildProcess, // External process
      pid,
      logBuffer: createLogBuffer(1000),
      startedAt: Date.now(),
      exitCode: null,
      exitSignal: null,
      logFile, // Store log file path for later reading
    };

    this.shells.set(shellId, instance);

    // Emit started event
    this.emit('started', { shellId, projectId, pid, command });

    // Start monitoring process
    this.monitorExternalProcess(shellId, pid);

    return shellId;
  }

  /**
   * Monitor an external process and emit exit when it dies
   */
  private monitorExternalProcess(shellId: string, pid: number): void {
    const checkInterval = setInterval(() => {
      const instance = this.shells.get(shellId);
      if (!instance || instance.exitCode !== null) {
        clearInterval(checkInterval);
        return;
      }

      if (!this.isPidAlive(pid)) {
        console.log(`[ShellManager] External process ${shellId} (PID ${pid}) has exited`);
        instance.exitCode = 0; // Assume clean exit
        this.emit('exit', {
          shellId,
          projectId: instance.projectId,
          code: 0,
          signal: null,
        });
        clearInterval(checkInterval);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Restore a shell from database record (for server restart recovery)
   * Note: We can't reattach to stdio, but we track the running process
   */
  restoreFromDb(shellRecord: {
    id: string;
    projectId: string;
    attemptId: string | null;
    command: string;
    cwd: string;
    pid: number | null;
  }): boolean {
    if (!shellRecord.pid) {
      console.log(`[ShellManager] Cannot restore shell ${shellRecord.id}: no PID`);
      return false;
    }

    if (!this.isPidAlive(shellRecord.pid)) {
      console.log(`[ShellManager] Shell ${shellRecord.id} PID ${shellRecord.pid} is no longer running`);
      return false;
    }

    // Already tracking this shell
    if (this.shells.has(shellRecord.id)) {
      return true;
    }

    console.log(`[ShellManager] Restoring shell ${shellRecord.id} with PID ${shellRecord.pid}`);

    // Create a partial instance - we can't reattach to process stdio
    // but we know it's running and can track it
    const instance: ShellInstance = {
      shellId: shellRecord.id,
      projectId: shellRecord.projectId,
      attemptId: shellRecord.attemptId || '',
      command: shellRecord.command,
      args: ['-c', shellRecord.command],
      cwd: shellRecord.cwd,
      process: null as unknown as ChildProcess, // Can't reattach
      pid: shellRecord.pid,
      logBuffer: createLogBuffer(1000), // Fresh buffer, old logs lost
      startedAt: Date.now(), // Approximate
      exitCode: null,
      exitSignal: null,
    };

    this.shells.set(shellRecord.id, instance);
    return true;
  }

  /**
   * Cleanup all shells on shutdown (only called for hard cleanup)
   */
  cleanup(): void {
    console.log(`[ShellManager] Cleaning up ${this.shells.size} shells`);
    for (const [shellId, instance] of this.shells) {
      if (instance.exitCode === null) {
        console.log(`[ShellManager] Killing shell ${shellId}`);
        try {
          instance.process.kill('SIGTERM');
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    }
  }

  // Type-safe event emitter methods
  override on<K extends keyof ShellEvents>(
    event: K,
    listener: ShellEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof ShellEvents>(
    event: K,
    ...args: Parameters<ShellEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

// Export singleton instance
export const shellManager = new ShellManager();
