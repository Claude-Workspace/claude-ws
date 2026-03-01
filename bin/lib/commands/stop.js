/**
 * `claude-ws stop` — Stop the running daemon.
 */

const daemon = require('../daemon');

async function run(_argv) {
  const { running, pid } = daemon.checkRunning();

  if (!running) {
    console.log('[claude-ws] No running daemon found.');
    process.exit(0);
  }

  console.log(`[claude-ws] Stopping daemon (PID ${pid})...`);

  // Send SIGTERM
  const sent = daemon.sendSignal(pid, 'SIGTERM');
  if (!sent) {
    console.log('[claude-ws] Failed to send SIGTERM — process may have already exited.');
    daemon.removePid();
    process.exit(0);
  }

  // Poll for exit (up to 10s)
  const exited = await daemon.waitForExit(pid, 10000);

  if (exited) {
    daemon.removePid();
    console.log('[claude-ws] Daemon stopped.');
    process.exit(0);
  }

  // Force kill
  console.log('[claude-ws] Daemon did not exit gracefully, sending SIGKILL...');
  daemon.sendSignal(pid, 'SIGKILL');

  const killed = await daemon.waitForExit(pid, 5000);
  daemon.removePid();

  if (killed) {
    console.log('[claude-ws] Daemon killed.');
  } else {
    console.log(`[claude-ws] Warning: Process ${pid} may still be running.`);
  }

  process.exit(0);
}

module.exports = { run };
