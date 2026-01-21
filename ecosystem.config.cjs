/**
 * PM2 Ecosystem Configuration for Claude Workspace
 *
 * Run with: pm2 start ecosystem.config.cjs
 * Stop with: pm2 stop claude-ws
 * Restart with: pm2 restart claude-ws
 * View logs: pm2 logs claude-ws
 * Monitor: pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'claude-ws',
      script: 'server.ts',
      interpreter: './node_modules/.bin/tsx',
      cwd: __dirname,

      // Environment
      env: {
        NODE_ENV: 'production',
      },

      // Process management
      instances: 1,
      exec_mode: 'fork',

      // Auto-restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',

      // Logs
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Advanced features
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.next', '.git'],

      // Kill timeout
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
