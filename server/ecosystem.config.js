module.exports = {
  apps: [
    {
      name: 'hotel-qr-server',
      script: 'src/index.js',
      cwd: '/var/www/hotel-qr/server',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: '/var/log/pm2/hotel-qr-error.log',
      out_file:   '/var/log/pm2/hotel-qr-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 4000,
      max_restarts: 10,
    },
  ],
}
