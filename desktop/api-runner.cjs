const path = require('path');

const apiDir = process.env.NCM_API_DIR || path.resolve(__dirname, '..', 'NeteaseCloudMusicApiEnhanced');
process.chdir(apiDir);

const fs = require('fs');
const tmpPath = require('os').tmpdir();

let apiApp = null;

function waitForListening(server) {
  if (server.listening && server.address()) return Promise.resolve(server.address());
  return new Promise((resolve, reject) => {
    server.once('listening', () => resolve(server.address()));
    server.once('error', reject);
  });
}

async function start() {
  if (!fs.existsSync(path.resolve(tmpPath, 'anonymous_token'))) {
    fs.writeFileSync(path.resolve(tmpPath, 'anonymous_token'), '', 'utf-8');
  }

  const generateConfig = require(path.join(apiDir, 'generateConfig'));
  const { serveNcmApi } = require(path.join(apiDir, 'server'));

  await generateConfig();
  apiApp = await serveNcmApi({
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 0),
    checkVersion: false,
  });

  if (process.send) {
    const address = await waitForListening(apiApp.server);
    process.send({ type: 'ready', port: typeof address === 'object' ? address.port : Number(process.env.PORT || 0) });
  }
}

function shutdown() {
  const server = apiApp?.server;
  if (!server) process.exit(0);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('message', (message) => {
  if (message === 'shutdown' || message?.type === 'shutdown') shutdown();
});

start().catch((err) => {
  console.error(err);
  if (process.send) process.send({ type: 'error', message: err.message || String(err) });
  process.exit(1);
});
