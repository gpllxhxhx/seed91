const path = require('path');

const rootDir = __dirname;
const apiDir = path.join(rootDir, 'NeteaseCloudMusicApiEnhanced');

module.exports = {
  apps: [
    {
      name: 'music-web',
      cwd: rootDir,
      script: 'app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '8000',
      },
    },
    {
      name: 'music-api',
      cwd: apiDir,
      script: 'app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '3000',
        CORS_ALLOW_ORIGIN: '',
        ENABLE_GENERAL_UNBLOCK: 'true',
        ENABLE_FLAC: 'true',
        SELECT_MAX_BR: 'false',
        FOLLOW_SOURCE_ORDER: 'true',
      },
    },
  ],
};
