/**
 * Shell Manager - Manages background shell processes per project
 *
 * Follows AgentManager pattern with EventEmitter for Socket.io forwarding.
 * Shells belong to projects (not tasks), persist across task switches.
 *
 * Process monitoring extracted to: shell-process-monitor.ts
 * Cleanup/stop logic extracted to: shell-cleanup-and-stop.ts
 */

import { EventEmitter } from 'events';
import { spawn, type ChildProcess } from 'child_process';
import { nanoid } from 'nanoid';
import { createLogBuffer, type LogBuffer, type LogEntry } from './circular-buffer';
import { createLogger } from './logger';
import {
  isPidAlive,
  trackExternalProcess,
  restoreFromDb,
} from './shell-process-monitor';
import {
  stopShell,
  removeShell,
  cleanupAllShells,
} from './shell-cleanup-and-stop';
import {
  setupProcessHandlers,
  toShellInfo,
  readShellLogs,
} from './shell-instance-output-helpers';

const log = createLogger('ShellManager');

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
  logFile?: string;
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
    process.on('exit', () => {
      const running = this.runningCount;
      if (running > 0) {
        log.info({ count: running }, 'Server exiting, shells will continue running independently');
      }
    });
  }

  /** Spawn a new background shell process */
  spawn(options: ShellStartOptions): string {
    const { projectId, attemptId, command, cwd } = options;
    const shellId = nanoid();

    log.debug({ shellId, cwd, command }, 'Spawning shell');

    const child = spawn('bash', ['-c', command], {
      cwd,
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.unref();

    if (!child.pid) {
      log.error({ shellId, command }, 'Failed to spawn process');
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
    setupProcessHandlers(child, instance, this);
    this.emit('started', { shellId, projectId, pid: child.pid, command });

    log.debug({ shellId, pid: child.pid }, 'Shell started');
    return shellId;
  }

  /** Stop a running shell process */
  stop(shellId: string, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    return stopShell(shellId, signal, this.shells, this);
  }

  /** Get shell instance by ID */
  getShell(shellId: string): ShellInstance | undefined {
    return this.shells.get(shellId);
  }

  /** Get all shells for a project */
  getShellsByProject(projectId: string): ShellInstance[] {
    return Array.from(this.shells.values()).filter(s => s.projectId === projectId);
  }

  /** Get shell info for API/client */
  getShellInfo(shellId: string): ShellInfo | undefined {
    const shell = this.shells.get(shellId);
    if (!shell) return undefined;
    return toShellInfo(shell);
  }

  /** Get all shell infos for a project */
  getShellInfosByProject(projectId: string): ShellInfo[] {
    return this.getShellsByProject(projectId).map(s => toShellInfo(s));
  }

  /** Get recent logs from a shell (reads from log file for external processes) */
  getRecentLogs(shellId: string, lines: number = 100): LogEntry[] {
    const shell = this.shells.get(shellId);
    if (!shell) return [];
    return readShellLogs(shell, lines);
  }

  /** Check if a shell is running */
  isRunning(shellId: string): boolean {
    const shell = this.shells.get(shellId);
    return shell ? shell.exitCode === null : false;
  }

  /** Get count of running shells */
  get runningCount(): number {
    return Array.from(this.shells.values()).filter(s => s.exitCode === null).length;
  }

  /** Get all shell IDs */
  getAllShellIds(): string[] {
    return Array.from(this.shells.keys());
  }

  /** Remove a stopped shell from tracking */
  remove(shellId: string): boolean {
    return removeShell(shellId, this.shells);
  }

  /** Check if a PID is still running */
  isPidAlive(pid: number): boolean {
    return isPidAlive(pid);
  }

  /** Track an external process by PID */
  trackExternalProcess(options: {
    projectId: string;
    attemptId: string;
    command: string;
    cwd: string;
    pid: number;
    logFile?: string;
  }): string | null {
    return trackExternalProcess(options, this.shells, this);
  }

  /** Restore a shell from database record (for server restart recovery) */
  restoreFromDb(shellRecord: {
    id: string;
    projectId: string;
    attemptId: string | null;
    command: string;
    cwd: string;
    pid: number | null;
  }): boolean {
    return restoreFromDb(shellRecord, this.shells);
  }

  /** Cleanup all shells on shutdown */
  cleanup(): void {
    cleanupAllShells(this.shells);
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
