/**
 * `claude-ws start` — Start claude-ws as a background daemon.
 */

const { parse } = require('../cli-parser');
const config = require('../config');
const daemon = require('../daemon');
const health = require('../health');

const FLAG_SCHEMA = {
  flags: {
    port: { type: 'string', alias: 'p' },
    host: { type: 'string' },
    'data-dir': { type: 'string' },
    'log-dir': { type: 'string' },
    'no-open': { type: 'boolean' },
  },
};

async function run(argv) {
  const { flags } = parse(argv, FLAG_SCHEMA);
  const conf = config.resolve(flags);

  // Check if already running
  const { running, pid } = daemon.checkRunning();
  if (running) {
    console.log(`[claude-ws] Already running (PID ${pid})`);
    console.log(`[claude-ws] URL: http://${conf.host}:${conf.port}`);
    console.log('[claude-ws] Use "claude-ws stop" to stop it first.');
    process.exit(1);
  }

  console.log('[claude-ws] Starting daemon...');
  console.log(`[claude-ws] Port: ${conf.port}`);
  console.log(`[claude-ws] Host: ${conf.host}`);
  console.log(`[claude-ws] Data: ${conf.dataDir}`);
  console.log(`[claude-ws] Logs: ${conf.logDir}`);

  const childPid = daemon.daemonize({
    port: conf.port,
    host: conf.host,
    dataDir: conf.dataDir,
    logDir: conf.logDir,
    noOpen: flags['no-open'],
  });

  console.log(`[claude-ws] Daemon started (PID ${childPid})`);
  console.log('[claude-ws] Waiting for server to become ready...');

  const ready = await health.waitUntilReady(conf.host, conf.port, 60000, 2000);

  if (ready) {
    console.log(`[claude-ws] Server is ready at http://${conf.host}:${conf.port}`);

    // Open browser unless --no-open
    if (!flags['no-open']) {
      try {
        const openCmd = require('../commands/open');
        openCmd.openUrl(`http://${conf.host}:${conf.port}`);
      } catch {
        // Non-critical — don't fail the start
      }
    }
  } else {
    console.log('[claude-ws] Server did not respond within 60s.');
    console.log('[claude-ws] Check logs: claude-ws logs');
    console.log('[claude-ws] The daemon may still be starting up (building, installing deps, etc.).');
  }

  process.exit(0);
}

module.exports = { run };
