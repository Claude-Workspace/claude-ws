/**
 * HTTP health check against a running claude-ws server.
 */

const http = require('http');

/**
 * Perform a simple HTTP GET to check if the server is responding.
 *
 * @param {string} host
 * @param {number} port
 * @param {number} [timeoutMs=3000]
 * @returns {Promise<{ ok: boolean, statusCode?: number, error?: string }>}
 */
function check(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/`, { timeout: timeoutMs }, (res) => {
      // Any HTTP response means the server is alive
      resolve({ ok: true, statusCode: res.statusCode });
      res.resume(); // Drain the response
    });

    req.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
  });
}

/**
 * Poll until the server responds or timeout is reached.
 *
 * @param {string} host
 * @param {number} port
 * @param {number} [timeoutMs=30000]
 * @param {number} [intervalMs=1000]
 * @returns {Promise<boolean>}
 */
function waitUntilReady(host, port, timeoutMs = 30000, intervalMs = 1000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const attempt = async () => {
      const result = await check(host, port, 2000);
      if (result.ok) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(attempt, intervalMs);
    };
    attempt();
  });
}

module.exports = { check, waitUntilReady };
