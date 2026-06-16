const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'NeteaseCloudMusicApiEnhanced');
const inheritedCorsOrigin = process.env.CORS_ALLOW_ORIGIN || '';

const env = {
  ...process.env,
  HOST: process.env.HOST || '0.0.0.0',
  PORT: process.env.PORT || '3000',
  CORS_ALLOW_ORIGIN: inheritedCorsOrigin === '*' ? '' : inheritedCorsOrigin,
  ENABLE_GENERAL_UNBLOCK: process.env.ENABLE_GENERAL_UNBLOCK || 'true',
  ENABLE_FLAC: process.env.ENABLE_FLAC || 'true',
  SELECT_MAX_BR: process.env.SELECT_MAX_BR || 'false',
  FOLLOW_SOURCE_ORDER: process.env.FOLLOW_SOURCE_ORDER || 'true',
};

const child = spawn(process.execPath, ['app.js'], {
  cwd: apiDir,
  env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
