const { BrowserWindow, screen } = require('electron');
const path = require('path');

class LyricWindow {
  constructor({ app, config, logger }) {
    this.app = app;
    this.config = config;
    this.logger = logger;
    this.window = null;
  }

  create() {
    if (this.window && !this.window.isDestroyed()) return this.window;
    const lyricConfig = this.config.get('lyric');
    const display = screen.getPrimaryDisplay().workArea;
    const width = 820;
    const height = 120;
    const x = Number.isFinite(lyricConfig.x) ? lyricConfig.x : Math.round(display.x + (display.width - width) / 2);
    const y = Number.isFinite(lyricConfig.y) ? lyricConfig.y : Math.round(display.y + display.height - height - 64);

    this.logger?.info('creating lyric window', { ...lyricConfig, x, y });
    this.window = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      hasShadow: false,
      show: Boolean(lyricConfig.visible),
      webPreferences: {
        preload: path.join(this.app.getAppPath(), 'desktop', 'preload', 'lyric-preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    this.window.setAlwaysOnTop(true, 'screen-saver');
    this.setLocked(Boolean(lyricConfig.locked));
    this.window.on('moved', () => this.savePosition());
    this.window.on('close', (event) => {
      if (!this.app.isQuitting) {
        event.preventDefault();
        this.hide();
      }
    });
    this.window.on('closed', () => {
      this.window = null;
    });

    this.window.loadFile(path.join(this.app.getAppPath(), 'desktop', 'renderer', 'lyric', 'LyricOverlay.html'));
    return this.window;
  }

  savePosition() {
    if (!this.window || this.window.isDestroyed()) return;
    const [x, y] = this.window.getPosition();
    this.config.update('lyric', { x, y });
  }

  show() {
    const win = this.create();
    win.showInactive();
    this.config.update('lyric', { visible: true });
  }

  hide() {
    if (this.window && !this.window.isDestroyed()) this.window.hide();
    this.config.update('lyric', { visible: false });
  }

  toggle() {
    if (!this.window || this.window.isDestroyed() || !this.window.isVisible()) this.show();
    else this.hide();
  }

  setLocked(locked) {
    const win = this.create();
    win.setIgnoreMouseEvents(Boolean(locked), { forward: true });
    this.config.update('lyric', { locked: Boolean(locked) });
    this.send('lyric:lock-state', { locked: Boolean(locked), config: this.config.get('lyric') });
  }

  send(channel, payload) {
    if (!this.window || this.window.isDestroyed()) return false;
    this.window.webContents.send(channel, payload);
    return true;
  }
}

module.exports = { LyricWindow };
