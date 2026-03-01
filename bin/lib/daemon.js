/**
 * Daemon utilities: PID file management, process checks, daemonization.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('./config');

/**
 * Read PID from PID file.
 * @returns {number|null}
 */
function readPid() {
  try {
    const raw = fs.readFileSync(config.PID_PATH, 'utf-8').trim();
    const pid = parseInt(raw, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Write PID to PID file.
 * @param {number} pid
 */
function writePid(pid) {
  config.ensureDir();
  fs.writeFileSync(config.PID_PATH, String(pid), 'utf-8');
}

/**
 * Remove PID file.
 */
function removePid() {
  try {
    fs.unlinkSync(config.PID_PATH);
  } catch {
    // Already gone — that's fine
  }
}

/**
 * Check whether a process with the given PID is alive.
 * @param {number} pid
 * @returns {boolean}
 */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a daemon is already running.
 * Cleans up stale PID file if the process is dead.
 *
 * @returns {{ running: boolean, pid: number|null }}
 */
function checkRunning() {
  const pid = readPid();
  if (pid === null) {
    return { running: false, pid: null };
  }
  if (isAlive(pid)) {
    return { running: true, pid };
  }
  // Stale PID file — clean up
  removePid();
  return { running: false, pid: null };
}

/**
 * Spawn the claude-ws foreground process as a detached daemon.
 *
 * @param {{ port: number, host: string, dataDir: string, logDir: string, noOpen?: boolean }} opts
 * @returns {number} The child PID
 */
function daemonize(opts) {
  const entryPoint = path.resolve(__dirname, '..', 'claude-ws.js');

  const stdoutPath = path.join(opts.logDir, 'claude-ws.log');
  const stderrPath = path.join(opts.logDir, 'claude-ws-error.log');

  const stdoutFd = fs.openSync(stdoutPath, 'a');
  const stderrFd = fs.openSync(stderrPath, 'a');

  const env = {
    ...process.env,
    PORT: String(opts.port),
    HOST: opts.host,
    DATA_DIR: opts.dataDir,
    CLAUDE_WS_DAEMON: '1', // Signal to the entry point that this is a daemon child
  };

  const child = spawn(process.execPath, [entryPoint], {
    cwd: process.cwd(),
    detached: true,
    stdio: ['ignore', stdoutFd, stderrFd],
    env,
  });

  child.unref();

  // Close the fd handles in this (parent) process
  fs.closeSync(stdoutFd);
  fs.closeSync(stderrFd);

  const pid = child.pid;
  writePid(pid);

  return pid;
}

/**
 * Send a signal to the daemon process.
 *
 * @param {number} pid
 * @param {string} signal - e.g. 'SIGTERM', 'SIGKILL'
 * @returns {boolean} true if signal was sent successfully
 */
function sendSignal(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for a process to exit, polling every interval ms.
 *
 * @param {number} pid
 * @param {number} timeoutMs
 * @param {number} [intervalMs=500]
 * @returns {Promise<boolean>} true if process exited within timeout
 */
function waitForExit(pid, timeoutMs, intervalMs = 500) {
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (!isAlive(pid)) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, intervalMs);
  });
}

module.exports = {
  readPid,
  writePid,
  removePid,
  isAlive,
  checkRunning,
  daemonize,
  sendSignal,
  waitForExit,
};
