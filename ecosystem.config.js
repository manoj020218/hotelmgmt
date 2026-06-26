module.exports = {
  apps: [
    {
      name: 'hotelqr-api',
      script: 'src/index.js',
      cwd: '/root/projects/hotelqr/server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
