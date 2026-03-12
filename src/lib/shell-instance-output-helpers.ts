/**
 * Shell Instance Output Helpers - Process I/O handlers, log reading, and ShellInfo conversion
 *
 * Extracted from shell-manager.ts. Handles stdout/stderr/exit/error event wiring
 * for spawned child processes, log file reading, and ShellInstance → ShellInfo mapping.
 */

import { type ChildProcess } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { createLogger } from './logger';
import type { LogEntry } from './circular-buffer';
import type { ShellInstance, ShellInfo } from './shell-manager';

const log = createLogger('ShellInstanceOutputHelpers');

/** Callback interface matching the subset of EventEmitter used by ShellManager */
export interface ShellOutputEmitter {
  emit(event: 'output', data: { shellId: string; projectId: string; type: 'stdout' | 'stderr'; content: string }): boolean;
  emit(event: 'exit', data: { shellId: string; projectId: string; code: number | null; signal: string | null }): boolean;
}

/**
 * Attach stdout/stderr/exit/error handlers to a spawned child process.
 * Pushes data into instance.logBuffer and forwards events via the emitter.
 */
export function setupProcessHandlers(
  child: ChildProcess,
  instance: ShellInstance,
  emitter: ShellOutputEmitter
): void {
  const { shellId, projectId } = instance;

  child.stdout?.on('data', (data: Buffer) => {
    const content = data.toString();
    instance.logBuffer.push({ type: 'stdout', content, timestamp: Date.now() });
    emitter.emit('output', { shellId, projectId, type: 'stdout', content });
  });

  child.stderr?.on('data', (data: Buffer) => {
    const content = data.toString();
    instance.logBuffer.push({ type: 'stderr', content, timestamp: Date.now() });
    emitter.emit('output', { shellId, projectId, type: 'stderr', content });
  });

  child.on('exit', (code, signal) => {
    log.debug({ shellId, code, signal }, 'Shell exited');
    instance.exitCode = code;
    instance.exitSignal = signal;
    emitter.emit('exit', { shellId, projectId, code, signal });
  });

  child.on('error', (error) => {
    log.error({ shellId, err: error }, 'Shell error');
    const content = `Process error: ${error.message}`;
    instance.logBuffer.push({ type: 'stderr', content, timestamp: Date.now() });
    emitter.emit('output', { shellId, projectId, type: 'stderr', content });
  });
}

/**
 * Convert a ShellInstance to a plain ShellInfo object for API/client responses.
 */
export function toShellInfo(s: ShellInstance): ShellInfo {
  return {
    shellId: s.shellId,
    projectId: s.projectId,
    attemptId: s.attemptId,
    command: s.command,
    pid: s.pid,
    startedAt: s.startedAt,
    isRunning: s.exitCode === null,
    exitCode: s.exitCode,
  };
}

/**
 * Read the last N lines from a shell's log file, falling back to the in-memory buffer.
 */
export function readShellLogs(shell: ShellInstance, lines: number): LogEntry[] {
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
      log.warn({ logFile: shell.logFile, err }, 'Failed to read log file');
    }
  }
  return shell.logBuffer.getLast(lines);
}
