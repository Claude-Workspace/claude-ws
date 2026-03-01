/**
 * `claude-ws open` — Open browser to the running instance.
 */

const { exec } = require('child_process');
const config = require('../config');
const daemon = require('../daemon');

/**
 * Open a URL in the default browser (cross-platform).
 * @param {string} url
 */
function openUrl(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, (err) => {
    if (err) {
      console.log(`[claude-ws] Could not open browser. Visit: ${url}`);
    }
  });
}

async function run(_argv) {
  const { running, pid } = daemon.checkRunning();

  if (!running) {
    console.log('[claude-ws] No running daemon found.');
    console.log('[claude-ws] Start one first: claude-ws start');
    process.exit(1);
  }

  const conf = config.resolve({});
  const url = `http://${conf.host}:${conf.port}`;

  console.log(`[claude-ws] Opening ${url} (PID ${pid})`);
  openUrl(url);

  process.exit(0);
}

module.exports = { run, openUrl };
