const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'music-pet-stability-'));
}

test('Logger writes daily app log files under userData logs and redacts sensitive metadata', () => {
  const tempDir = makeTempDir();
  const { Logger } = require(path.join(__dirname, 'desktop', 'main', 'services', 'logger.cjs'));
  const app = {
    getPath(name) {
      assert.equal(name, 'userData');
      return tempDir;
    },
    getVersion() {
      return '0.1.0-test';
    },
    isPackaged: false,
  };

  const logger = new Logger(app);
  logger.init();
  logger.info('desktop log test', {
    keep: 'ok',
    token: 'secret-token',
    nested: { cookie: 'cookie-value' },
  });

  const logDir = path.join(tempDir, 'logs');
  const files = fs.readdirSync(logDir);
  assert.equal(files.length, 1);
  assert.match(files[0], /^app-\d{4}-\d{2}-\d{2}\.log$/);

  const content = fs.readFileSync(path.join(logDir, files[0]), 'utf8');
  assert.match(content, /desktop log test/);
  assert.match(content, /"keep":"ok"/);
  assert.doesNotMatch(content, /secret-token/);
  assert.doesNotMatch(content, /cookie-value/);
  assert.match(content, /\[redacted\]/);
});

test('ConfigStore falls back to defaults and persists a structured desktop config after broken JSON', () => {
  const tempDir = makeTempDir();
  const warnings = [];
  const { ConfigStore } = require(path.join(__dirname, 'desktop', 'main', 'services', 'config-store.cjs'));
  const app = {
    getPath(name) {
      assert.equal(name, 'userData');
      return tempDir;
    },
  };
  const logger = {
    warn(message, meta) {
      warnings.push({ message, meta });
    },
    info() {},
  };

  const store = new ConfigStore(app, logger);
  fs.mkdirSync(path.dirname(store.filePath), { recursive: true });
  fs.writeFileSync(store.filePath, '{broken json', 'utf8');

  const loaded = store.load();

  assert.equal(loaded.window.alwaysOnTop, true);
  assert.equal(loaded.window.opacity, 1);
  assert.equal(loaded.player.volume, 0.8);
  assert.equal(loaded.player.muted, false);
  assert.equal(loaded.player.lastSong, null);
  assert.equal(loaded.pet.selectedSkin, 'default');
  assert.equal(loaded.pet.size, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /config read failed/i);

  store.update('player', { muted: true, lastPlaylist: { playlistId: 123, playlistName: 'Test List' } });
  const saved = JSON.parse(fs.readFileSync(store.filePath, 'utf8'));
  assert.equal(saved.player.muted, true);
  assert.equal(saved.player.lastPlaylist.playlistId, 123);
});

test('window state helper clamps saved pet positions back into a visible display area', () => {
  const { clampWindowToVisibleArea } = require(path.join(__dirname, 'desktop', 'main', 'services', 'window-state.cjs'));

  const displays = [
    { workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
    { workArea: { x: 1920, y: 0, width: 1600, height: 900 } },
  ];

  assert.deepEqual(
    clampWindowToVisibleArea({
      bounds: { x: 9999, y: 9999, width: 260, height: 320 },
      displays,
    }),
    { x: 3260, y: 580 }
  );

  assert.deepEqual(
    clampWindowToVisibleArea({
      bounds: { x: 120, y: 150, width: 260, height: 320 },
      displays,
    }),
    { x: 120, y: 150 }
  );
});

test('player preload exposes desktop config and renderer log bridge without leaking raw ipc access', () => {
  const source = fs.readFileSync(path.join(__dirname, 'desktop', 'preload', 'player-preload.cjs'), 'utf8');
  const exposures = {};
  const invokes = [];
  const sends = [];
  const listeners = [];

  vm.runInNewContext(source, {
    module: { exports: {} },
    exports: {},
    require(id) {
      if (id === 'electron') {
        return {
          contextBridge: {
            exposeInMainWorld(name, value) {
              exposures[name] = value;
            },
          },
          ipcRenderer: {
            invoke(channel, payload) {
              invokes.push({ channel, payload });
              return Promise.resolve({ channel, payload });
            },
            send(channel, payload) {
              sends.push({ channel, payload });
            },
            on(channel, listener) {
              listeners.push({ channel, listener });
            },
            removeListener() {},
          },
        };
      }
      return require(id);
    },
  }, { filename: 'desktop/preload/player-preload.cjs' });

  assert.equal(typeof exposures.musicDesktopPlayer?.syncPlaybackState, 'function');
  assert.equal(typeof exposures.musicDesktopPlayer?.config?.get, 'function');
  assert.equal(typeof exposures.musicDesktopPlayer?.config?.update, 'function');
  assert.equal(typeof exposures.musicDesktopPlayer?.reportLog, 'function');
  assert.equal(typeof exposures.musicDesktopPlayer?.ipcRenderer, 'undefined');

  exposures.musicDesktopPlayer.config.get();
  exposures.musicDesktopPlayer.config.update({ player: { volume: 0.5 } });
  exposures.musicDesktopPlayer.reportLog({ level: 'error', message: 'renderer failed' });
  exposures.musicDesktopPlayer.onCommand(() => {});

  assert.deepEqual(invokes[0], { channel: 'desktop:config:get', payload: undefined });
  assert.deepEqual(invokes[1], {
    channel: 'desktop:config:update',
    payload: { player: { volume: 0.5 } },
  });
  assert.deepEqual(sends[0], {
    channel: 'desktop:log:report',
    payload: { level: 'error', message: 'renderer failed' },
  });
  assert.equal(listeners[0].channel, 'playback:command');
});
