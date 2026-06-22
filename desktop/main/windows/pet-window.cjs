const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { clampWindowToVisibleArea } = require('../services/window-state.cjs');

class PetWindow {
  constructor({ app, config, logger, buildMenu, petPackage }) {
    this.app = app;
    this.config = config;
    this.logger = logger;
    this.buildMenu = buildMenu;
    this.petPackage = petPackage;
    this.window = null;
  }

  create() {
    if (this.window && !this.window.isDestroyed()) return this.window;
    const petConfig = this.config.get('pet');
    const windowConfig = this.config.get('window');
    const manifest = this.petPackage?.manifest || {};
    const width = Number(manifest.width) || 260;
    const height = Number(manifest.height) || 320;
    const safePosition = clampWindowToVisibleArea({
      bounds: {
        x: windowConfig.x,
        y: windowConfig.y,
        width,
        height,
      },
      displays: screen.getAllDisplays(),
    });

    this.logger?.info('creating pet window', {
      width,
      height,
      savedPosition: { x: windowConfig.x, y: windowConfig.y },
      safePosition,
    });

    this.window = new BrowserWindow({
      width,
      height,
      x: Number.isFinite(safePosition.x) ? safePosition.x : undefined,
      y: Number.isFinite(safePosition.y) ? safePosition.y : undefined,
      frame: false,
      transparent: true,
      alwaysOnTop: windowConfig.alwaysOnTop !== false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: path.join(this.app.getAppPath(), 'desktop', 'preload', 'pet-preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    if (Number.isFinite(safePosition.x) && Number.isFinite(safePosition.y)
      && (safePosition.x !== windowConfig.x || safePosition.y !== windowConfig.y)) {
      this.config.update('window', { x: safePosition.x, y: safePosition.y });
    }

    this.window.setAlwaysOnTop(windowConfig.alwaysOnTop !== false, 'screen-saver');
    if (Number.isFinite(Number(windowConfig.opacity))) {
      this.window.setOpacity(Math.max(0.3, Math.min(1, Number(windowConfig.opacity))));
    }
    this.window.once('ready-to-show', () => {
      this.logger?.info('pet window ready');
      this.window.show();
    });
    this.window.on('moved', () => this.savePosition());
    this.window.on('close', (event) => {
      if (!this.app.isQuitting) {
        event.preventDefault();
        this.savePosition();
        this.window.hide();
      }
    });
    this.window.on('closed', () => {
      this.window = null;
    });
    this.window.webContents.on('context-menu', () => {
      this.buildMenu()?.popup({ window: this.window });
    });
    this.window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      this.logger?.error('pet window failed to load resources', { errorCode, errorDescription, validatedURL });
    });

    this.window.loadFile(path.join(this.app.getAppPath(), 'desktop', 'renderer', 'pet', 'PetView.html')).catch((error) => {
      this.logger?.error('pet window loadFile failed', { error: error?.stack || error?.message || String(error) });
    });
    return this.window;
  }

  savePosition() {
    if (!this.window || this.window.isDestroyed()) return;
    const [x, y] = this.window.getPosition();
    this.config.update('window', { x, y });
  }

  send(channel, payload) {
    if (!this.window || this.window.isDestroyed()) return false;
    this.window.webContents.send(channel, payload);
    return true;
  }
}

module.exports = { PetWindow };
