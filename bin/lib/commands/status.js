/**
 * `claude-ws status` — Show daemon status, PID, URL, and health.
 */

const config = require('../config');
const daemon = require('../daemon');
const health = require('../health');

async function run(_argv) {
  const { running, pid } = daemon.checkRunning();

  if (!running) {
    console.log('[claude-ws] Status: NOT RUNNING');
    process.exit(0);
  }

  const conf = config.resolve({});
  const result = await health.check(conf.host, conf.port);

  console.log('[claude-ws] Status: RUNNING');
  console.log(`[claude-ws] PID: ${pid}`);
  console.log(`[claude-ws] URL: http://${conf.host}:${conf.port}`);

  if (result.ok) {
    console.log(`[claude-ws] Health: OK (HTTP ${result.statusCode})`);
  } else {
    console.log(`[claude-ws] Health: UNREACHABLE (${result.error})`);
    console.log('[claude-ws] The server process is running but not responding to HTTP.');
    console.log('[claude-ws] It may still be starting up. Check: claude-ws logs');
  }

  process.exit(0);
}

module.exports = { run };
