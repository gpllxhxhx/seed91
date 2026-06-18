const { BrowserWindow } = require('electron');
const path = require('path');

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
    const manifest = this.petPackage?.manifest || {};
    this.logger?.info('creating pet window', petConfig);

    this.window = new BrowserWindow({
      width: Number(manifest.width) || 260,
      height: Number(manifest.height) || 320,
      x: Number.isFinite(petConfig.x) ? petConfig.x : undefined,
      y: Number.isFinite(petConfig.y) ? petConfig.y : undefined,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
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

    this.window.setAlwaysOnTop(true, 'screen-saver');
    this.window.once('ready-to-show', () => this.window.show());
    this.window.on('moved', () => this.savePosition());
    this.window.on('close', (event) => {
      if (!this.app.isQuitting) {
        event.preventDefault();
        this.window.hide();
      }
    });
    this.window.on('closed', () => {
      this.window = null;
    });
    this.window.webContents.on('context-menu', () => {
      this.buildMenu()?.popup({ window: this.window });
    });

    this.window.loadFile(path.join(this.app.getAppPath(), 'desktop', 'renderer', 'pet', 'PetView.html'));
    return this.window;
  }

  savePosition() {
    if (!this.window || this.window.isDestroyed()) return;
    const [x, y] = this.window.getPosition();
    this.config.update('pet', { x, y });
  }

  send(channel, payload) {
    if (!this.window || this.window.isDestroyed()) return false;
    this.window.webContents.send(channel, payload);
    return true;
  }
}

module.exports = { PetWindow };
