/**
 * Terminal Manager - Interactive PTY session manager using node-pty
 *
 * Architecturally separate from ShellManager (background shells).
 * - Background shells: detached, survive server restart, read-only output
 * - Interactive terminals: PTY-attached, bidirectional I/O, die when connection drops
 *
 * Follows ShellManager EventEmitter singleton pattern.
 */

import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import { nanoid } from 'nanoid';
import { detectShell } from './terminal-shell-detect';
import { createLogger } from './logger';

const log = createLogger('TerminalManager');

export interface TerminalSession {
  id: string;
  projectId: string;
  ptyProcess: pty.IPty;
  cols: number;
  rows: number;
  cwd: string;
  createdAt: number;
}

interface TerminalEvents {
  output: (data: { terminalId: string; data: string }) => void;
  exit: (data: { terminalId: string; exitCode: number; signal?: number }) => void;
}

export interface TerminalCreateOptions {
  projectId: string;
  cwd: string;
  cols?: number;
  rows?: number;
  shell?: string;
}

class TerminalManager extends EventEmitter {
  private sessions = new Map<string, TerminalSession>();

  constructor() {
    super();
    process.on('exit', () => this.destroyAll());
  }

  create(options: TerminalCreateOptions): string {
    const { projectId, cwd, cols = 80, rows = 24, shell } = options;
    const terminalId = nanoid();

    const shellConfig = shell
      ? { file: shell, args: [] as string[], env: { TERM: 'xterm-256color' } }
      : detectShell();

    log.info({ terminalId, shell: shellConfig.file, cwd, cols, rows },
      'Creating terminal session');

    // Build clean env for PTY — remove vars that break nvm/shell init
    // npm_config_prefix conflicts with nvm — causes "not compatible" error and node disappears from PATH
    const { npm_config_prefix: _, ...cleanProcessEnv } = process.env;
    const ptyEnv = { ...cleanProcessEnv, ...shellConfig.env, LANG: process.env.LANG || 'en_US.UTF-8' };

    const ptyProcess = pty.spawn(shellConfig.file, shellConfig.args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: ptyEnv as Record<string, string>,
      ...(process.platform === 'win32' ? { useConpty: true } : {}),
    });

    const session: TerminalSession = {
      id: terminalId,
      projectId,
      ptyProcess,
      cols,
      rows,
      cwd,
      createdAt: Date.now(),
    };

    this.sessions.set(terminalId, session);

    ptyProcess.onData((data: string) => {
      this.emit('output', { terminalId, data });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      log.info({ terminalId, exitCode, signal }, 'Terminal session exited');
      this.sessions.delete(terminalId);
      this.emit('exit', { terminalId, exitCode, signal });
    });

    log.info({ terminalId, pid: ptyProcess.pid }, 'Terminal session created');
    return terminalId;
  }

  write(terminalId: string, data: string): boolean {
    const session = this.sessions.get(terminalId);
    if (!session) return false;
    session.ptyProcess.write(data);
    return true;
  }

  resize(terminalId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(terminalId);
    if (!session) return false;
    session.cols = cols;
    session.rows = rows;
    session.ptyProcess.resize(cols, rows);
    return true;
  }

  destroy(terminalId: string): boolean {
    const session = this.sessions.get(terminalId);
    if (!session) return false;
    log.info({ terminalId }, 'Destroying terminal session');
    session.ptyProcess.kill();
    this.sessions.delete(terminalId);
    return true;
  }

  destroyAll(): void {
    log.info({ count: this.sessions.size }, 'Destroying all terminal sessions');
    for (const [, session] of this.sessions) {
      try { session.ptyProcess.kill(); } catch { /* ignore */ }
    }
    this.sessions.clear();
  }

  has(terminalId: string): boolean {
    return this.sessions.has(terminalId);
  }

  getTerminalsByProject(projectId: string): string[] {
    return Array.from(this.sessions.values())
      .filter(s => s.projectId === projectId)
      .map(s => s.id);
  }

  get activeCount(): number {
    return this.sessions.size;
  }

  override on<K extends keyof TerminalEvents>(
    event: K, listener: TerminalEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof TerminalEvents>(
    event: K, ...args: Parameters<TerminalEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

export const terminalManager = new TerminalManager();
