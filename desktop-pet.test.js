const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = __dirname;

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('pet preload exposes stable petAPI methods and legacy musicPet aliases', () => {
  const source = read('desktop/preload/pet-preload.cjs');
  const exposures = {};
  const onCalls = [];
  const removed = [];

  const ipcRenderer = {
    invoke(channel) {
      return channel;
    },
    on(channel, listener) {
      onCalls.push({ channel, listener });
    },
    removeListener(channel, listener) {
      removed.push({ channel, listener });
    },
  };

  vm.runInNewContext(source, {
    module: { exports: {} },
    exports: {},
    require(id) {
      if (id === 'electron') return {
        contextBridge: {
          exposeInMainWorld(name, value) {
            exposures[name] = value;
          },
        },
        ipcRenderer,
      };
      return require(id);
    },
  }, { filename: 'desktop/preload/pet-preload.cjs' });

  assert.equal(typeof exposures.petAPI?.playPause, 'function');
  assert.equal(typeof exposures.petAPI?.next, 'function');
  assert.equal(typeof exposures.petAPI?.prev, 'function');
  assert.equal(typeof exposures.petAPI?.openMainWindow, 'function');
  assert.equal(typeof exposures.petAPI?.quit, 'function');
  assert.equal(typeof exposures.petAPI?.getPlaybackState, 'function');
  assert.equal(typeof exposures.petAPI?.onPlaybackState, 'function');
  assert.equal(typeof exposures.musicPet?.togglePlayback, 'function');
  assert.equal(typeof exposures.musicPet?.previous, 'function');
  assert.equal(typeof exposures.musicPet?.openPlayer, 'function');

  assert.equal(exposures.petAPI.playPause(), 'playback:toggle');
  assert.equal(exposures.petAPI.next(), 'playback:next');
  assert.equal(exposures.petAPI.prev(), 'playback:previous');
  assert.equal(exposures.petAPI.openMainWindow(), 'player:open');
  assert.equal(exposures.petAPI.quit(), 'app:quit');
  assert.equal(exposures.musicPet.togglePlayback(), 'playback:toggle');
  assert.equal(exposures.musicPet.previous(), 'playback:previous');
  assert.equal(exposures.musicPet.openPlayer(), 'player:open');

  const unsubscribe = exposures.petAPI.onPlaybackState(() => {});
  assert.equal(onCalls.length, 1);
  assert.equal(onCalls[0].channel, 'playback:state-changed');
  unsubscribe();
  assert.deepEqual(removed[0], onCalls[0]);
});

test('animation resolver applies interaction priority above playback status', () => {
  const {
    resolveAnimationState,
    playbackStatusToAnimation,
  } = require(path.join(rootDir, 'desktop', 'renderer', 'pet', 'animation-state.cjs'));

  assert.equal(playbackStatusToAnimation('loading'), 'loading');
  assert.equal(playbackStatusToAnimation('error'), 'error');
  assert.equal(resolveAnimationState({ playbackStatus: 'playing', hovering: true }), 'hover');
  assert.equal(resolveAnimationState({ playbackStatus: 'playing', hovering: true, clickedAt: Date.now() }), 'click');
  assert.equal(resolveAnimationState({ playbackStatus: 'error', hovering: true }), 'error');
  assert.equal(resolveAnimationState({ playbackStatus: 'paused' }), 'paused');
  assert.equal(resolveAnimationState({ playbackStatus: 'idle' }), 'idle');
});

test('default pet manifest uses the sprite runtime contract', () => {
  const manifestPath = path.join(rootDir, 'desktop', 'pets', 'default', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.id, 'default');
  assert.equal(manifest.renderer, 'sprite');
  assert.equal(typeof manifest.assets?.spriteSheet, 'string');
  assert.equal(typeof manifest.assets?.frameWidth, 'number');
  assert.equal(typeof manifest.assets?.frameHeight, 'number');

  for (const state of ['idle', 'hover', 'click', 'playing', 'paused', 'loading', 'error']) {
    assert.ok(manifest.states?.[state], `missing state ${state}`);
    assert.ok(Array.isArray(manifest.states[state].frames), `missing frames for ${state}`);
    assert.equal(typeof manifest.states[state].fps, 'number');
    assert.equal(typeof manifest.states[state].loop, 'boolean');
  }
});

test('pet package service loads the default pet manifest with a file asset base url', () => {
  const { loadPetPackage } = require(path.join(rootDir, 'desktop', 'main', 'services', 'pet-package-service.cjs'));
  const app = {
    getAppPath() {
      return rootDir;
    },
  };

  const petPackage = loadPetPackage({ app, petId: 'default' });

  assert.equal(petPackage.manifest.id, 'default');
  assert.equal(petPackage.manifest.width > 0, true);
  assert.equal(petPackage.manifest.height > 0, true);
  assert.match(petPackage.assetBaseUrl, /^file:/);
});
