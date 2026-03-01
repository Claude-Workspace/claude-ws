/**
 * `claude-ws logs` — Tail daemon log files.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { parse } = require('../cli-parser');
const config = require('../config');

const FLAG_SCHEMA = {
  flags: {
    follow: { type: 'boolean', alias: 'f', default: false },
    lines: { type: 'string', alias: 'n', default: '50' },
    error: { type: 'boolean', alias: 'e', default: false },
  },
};

function run(argv) {
  const { flags } = parse(argv, FLAG_SCHEMA);
  const conf = config.resolve({});

  const logFile = flags.error
    ? path.join(conf.logDir, 'claude-ws-error.log')
    : path.join(conf.logDir, 'claude-ws.log');

  if (!fs.existsSync(logFile)) {
    console.log(`[claude-ws] No log file found at ${logFile}`);
    console.log('[claude-ws] Has the daemon been started? Try: claude-ws start');
    process.exit(1);
  }

  const tailArgs = [];
  tailArgs.push('-n', flags.lines);
  if (flags.follow) {
    tailArgs.push('-f');
  }
  tailArgs.push(logFile);

  console.log(`[claude-ws] ${flags.error ? 'Error log' : 'Log'}: ${logFile}`);
  console.log('---');

  const tail = spawn('tail', tailArgs, { stdio: 'inherit' });

  tail.on('error', (err) => {
    // tail not available (Windows) — fall back to reading file
    if (err.code === 'ENOENT') {
      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.split('\n');
      const n = parseInt(flags.lines, 10) || 50;
      const tail = lines.slice(-n);
      console.log(tail.join('\n'));

      if (flags.follow) {
        console.log('[claude-ws] -f (follow) is not supported on this platform.');
      }
    } else {
      console.error(`[claude-ws] Error: ${err.message}`);
    }
    process.exit(1);
  });

  tail.on('close', (code) => {
    process.exit(code || 0);
  });

  // Forward Ctrl+C to tail
  process.on('SIGINT', () => {
    tail.kill('SIGINT');
  });
}

module.exports = { run };
