/**
 * Configuration loader for claude-ws daemon mode.
 *
 * Priority: CLI flags > env vars > config file > defaults.
 * Config file: ~/.claude-ws/config.json
 * PID file:    ~/.claude-ws/claude-ws.pid
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_WS_DIR = path.join(os.homedir(), '.claude-ws');
const CONFIG_PATH = path.join(CLAUDE_WS_DIR, 'config.json');
const PID_PATH = path.join(CLAUDE_WS_DIR, 'claude-ws.pid');

const DEFAULTS = {
  port: 8556,
  host: 'localhost',
  dataDir: path.join(CLAUDE_WS_DIR, 'data'),
  logDir: path.join(CLAUDE_WS_DIR, 'logs'),
};

/**
 * Ensure ~/.claude-ws/ directory exists.
 */
function ensureDir() {
  if (!fs.existsSync(CLAUDE_WS_DIR)) {
    fs.mkdirSync(CLAUDE_WS_DIR, { recursive: true });
  }
}

/**
 * Load config file if it exists.
 * @returns {object}
 */
function loadConfigFile() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[claude-ws] Warning: Failed to parse ${CONFIG_PATH}: ${err.message}`);
    return {};
  }
}

/**
 * Resolve the final configuration by merging defaults, config file, env vars,
 * and CLI flags (passed as an object).
 *
 * @param {object} [cliFlags={}] - Parsed CLI flags (e.g. { port: '3000', host: '0.0.0.0' })
 * @returns {{ port: number, host: string, dataDir: string, logDir: string }}
 */
function resolve(cliFlags = {}) {
  ensureDir();

  const file = loadConfigFile();

  const port = parseInt(
    cliFlags.port || process.env.PORT || file.port || DEFAULTS.port,
    10,
  );

  const host =
    cliFlags.host || process.env.HOST || file.host || DEFAULTS.host;

  const dataDir =
    cliFlags['data-dir'] || process.env.DATA_DIR || file.dataDir || DEFAULTS.dataDir;

  const logDir =
    cliFlags['log-dir'] || process.env.LOG_DIR || file.logDir || DEFAULTS.logDir;

  // Ensure log and data dirs exist
  for (const dir of [dataDir, logDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  return { port, host, dataDir, logDir };
}

module.exports = {
  CLAUDE_WS_DIR,
  CONFIG_PATH,
  PID_PATH,
  DEFAULTS,
  ensureDir,
  resolve,
};
