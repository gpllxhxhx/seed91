const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const HOST = '127.0.0.1';
const TOKEN_HEADER = 'x-music-desktop-token';
const HEALTH_TIMEOUT_MS = 30000;

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

class ApiProcessService {
  constructor({ app, token, frontendPort, logger }) {
    this.app = app;
    this.token = token;
    this.frontendPort = frontendPort;
    this.logger = logger;
    this.process = null;
    this.port = 0;
    this.baseUrl = '';
    this.quitting = false;
  }

  getAppRoot() {
    return this.app.getAppPath();
  }

  getResourcePath(relativePath) {
    return this.app.isPackaged
      ? path.join(process.resourcesPath, relativePath)
      : path.join(this.getAppRoot(), relativePath);
  }

  findAvailablePort(preferredPort = 3000) {
    return new Promise((resolve) => {
      const testServer = net.createServer();
      testServer.once('error', () => {
        const fallbackServer = net.createServer();
        fallbackServer.listen(0, HOST, () => {
          const port = fallbackServer.address().port;
          fallbackServer.close(() => resolve(port));
        });
      });
      testServer.listen(preferredPort, HOST, () => {
        testServer.close(() => resolve(preferredPort));
      });
    });
  }

  async start() {
    const apiDir = this.getResourcePath('NeteaseCloudMusicApiEnhanced');
    const runner = path.join(this.getAppRoot(), 'desktop', 'api-runner.cjs');
    const frontendOrigin = `http://${HOST}:${this.frontendPort}`;
    const selectedPort = await this.findAvailablePort(3000);
    this.logger?.info('starting api process', { runner, apiDir, host: HOST, port: selectedPort });

    this.process = spawn(process.execPath, [runner], {
      cwd: this.getAppRoot(),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NCM_API_DIR: apiDir,
        HOST,
        PORT: String(selectedPort),
        CORS_ALLOW_ORIGIN: frontendOrigin,
        DESKTOP_API_TOKEN: this.token,
        ENABLE_GENERAL_UNBLOCK: process.env.ENABLE_GENERAL_UNBLOCK || 'true',
        ENABLE_FLAC: process.env.ENABLE_FLAC || 'true',
        SELECT_MAX_BR: process.env.SELECT_MAX_BR || 'false',
        FOLLOW_SOURCE_ORDER: process.env.FOLLOW_SOURCE_ORDER || 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      windowsHide: true,
    });

    this.process.stdout?.on('data', (chunk) => {
      this.logger?.info('api stdout', { text: String(chunk).trim() });
    });
    this.process.stderr?.on('data', (chunk) => {
      this.logger?.warn('api stderr', { text: String(chunk).trim() });
    });
    this.process.once('exit', (code, signal) => {
      this.logger?.warn('api process exited', { code, signal });
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('API 启动超时')), HEALTH_TIMEOUT_MS);
      this.process.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      this.process.on('message', (message) => {
        if (message?.type === 'ready') {
          clearTimeout(timer);
          this.port = Number(message.port);
          this.baseUrl = `http://${HOST}:${this.port}`;
          this.logger?.info('api ready', { baseUrl: this.baseUrl });
          resolve();
        } else if (message?.type === 'error') {
          clearTimeout(timer);
          reject(new Error(message.message || 'API 启动失败'));
        }
      });
    });

    await this.waitForHealth();
    return { port: this.port, baseUrl: this.baseUrl };
  }

  async waitForHealth() {
    const startedAt = Date.now();
    let lastError = null;
    this.logger?.info('api health check started', { baseUrl: this.baseUrl });

    while (Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
      try {
        const res = await fetchWithTimeout(`${this.baseUrl}/inner/version`, {
          headers: { [TOKEN_HEADER]: this.token },
        });
        if (res.ok) {
          this.logger?.info('api health check passed', { status: res.status });
          return;
        }
        lastError = new Error(`API health check failed: HTTP ${res.status}`);
      } catch (err) {
        lastError = err;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    this.logger?.error('api health check failed', { error: lastError?.message });
    throw lastError || new Error('API health check failed');
  }

  stop() {
    this.quitting = true;
    if (!this.process || this.process.killed) return;
    this.logger?.info('stopping api process');
    try {
      this.process.send?.({ type: 'shutdown' });
    } catch (err) {
      this.logger?.warn('api shutdown message failed', { error: err.message });
    }
    this.process.kill('SIGTERM');
    this.process = null;
  }
}

module.exports = { ApiProcessService, HOST, TOKEN_HEADER };
