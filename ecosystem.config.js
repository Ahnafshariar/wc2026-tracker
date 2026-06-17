// PM2 process file for EC2: `pm2 start ecosystem.config.js`
// Runtime secrets (DATA_SOURCE, FOOTBALL_API_KEY) come from .env via dotenv,
// which the CD pipeline writes from a GitHub Actions secret. Nothing secret here.
module.exports = {
  apps: [{
    name: 'wc2026-tracker',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '300M',
    env: { NODE_ENV: 'production', PORT: 3000 }
  }]
};
