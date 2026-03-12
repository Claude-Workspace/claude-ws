module.exports = {
  apps: [
    {
      name: 'claudews',
      script: 'pnpm',
      args: 'run dev',
      interpreter: '/home/roxane/.nvm/versions/node/v22.16.0/bin/node',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PATH: '/home/roxane/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/usr/bin:/bin'
      },
      env_production: {
        NODE_ENV: 'production',
        PATH: '/home/roxane/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/usr/bin:/bin'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
