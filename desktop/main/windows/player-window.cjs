const { BrowserWindow, shell } = require('electron');
const path = require('path');

const EXTERNAL_URL_ALLOWLIST = [/^https:\/\/music\.163\.com\//i, /^https:\/\/neteasecloudmusicapienhanced\.js\.org\//i];

class PlayerWindow {
  constructor({ app, frontendUrl, logger }) {
    this.app = app;
    this.frontendUrl = frontendUrl;
    this.logger = logger;
    this.window = null;
  }

  create() {
    if (this.window && !this.window.isDestroyed()) return this.window;
    this.logger?.info('creating player window');

    this.window = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 980,
      minHeight: 640,
      show: false,
      backgroundColor: '#080607',
      webPreferences: {
        preload: path.join(this.app.getAppPath(), 'desktop', 'preload', 'player-preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });

    this.window.once('ready-to-show', () => {
      this.logger?.info('player window ready');
      this.window.show();
    });
    this.window.on('close', (event) => {
      if (!this.app.isQuitting) {
        event.preventDefault();
        this.window.hide();
      }
    });
    this.window.on('closed', () => {
      this.window = null;
    });

    this.window.webContents.setWindowOpenHandler(({ url }) => {
      if (EXTERNAL_URL_ALLOWLIST.some((pattern) => pattern.test(url))) shell.openExternal(url);
      return { action: 'deny' };
    });

    this.window.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(this.frontendUrl)) {
        event.preventDefault();
        if (EXTERNAL_URL_ALLOWLIST.some((pattern) => pattern.test(url))) shell.openExternal(url);
      }
    });
    this.window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      this.logger?.error('player window failed to load', { errorCode, errorDescription, validatedURL });
    });

    this.window.loadURL(this.frontendUrl).catch((error) => {
      this.logger?.error('player window loadURL failed', { error: error?.stack || error?.message || String(error) });
    });
    return this.window;
  }

  show() {
    const win = this.create();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }

  send(channel, payload) {
    if (!this.window || this.window.isDestroyed()) return false;
    this.window.webContents.send(channel, payload);
    return true;
  }
}

module.exports = { PlayerWindow };
