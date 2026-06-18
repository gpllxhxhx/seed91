const shell = document.getElementById('pet-shell');
const button = document.getElementById('pet-button');
const sprite = document.getElementById('pet-sprite');
const panel = document.getElementById('pet-panel');
const statusEl = document.getElementById('pet-status');
const playButton = document.getElementById('pet-action-play');
const prevButton = document.getElementById('pet-action-prev');
const nextButton = document.getElementById('pet-action-next');
const openButton = document.getElementById('pet-action-open');
const quitButton = document.getElementById('pet-action-quit');

const petApi = window.petAPI || window.musicPet;
const fallbackPackage = {
  manifest: {
    id: 'fallback',
    width: 260,
    height: 320,
    renderer: 'sprite',
    assets: {
      spriteSheet: '../../pets/default/sprite-sheet.svg',
      frameWidth: 220,
      frameHeight: 220,
    },
    states: {
      idle: { frames: [0], fps: 1, loop: true },
      hover: { frames: [1], fps: 1, loop: true },
      click: { frames: [2], fps: 1, loop: false },
      playing: { frames: [3, 4], fps: 4, loop: true },
      paused: { frames: [5], fps: 1, loop: true },
      loading: { frames: [6], fps: 2, loop: true },
      error: { frames: [7], fps: 1, loop: true },
    },
  },
  assetBaseUrl: window.location.href,
};

const statusText = {
  idle: '待命',
  loading: '加载中',
  playing: '播放中',
  paused: '已暂停',
  error: '播放错误',
};

let petPackage = fallbackPackage;
let playbackState = { status: 'idle', currentTrack: null };
let hovering = false;
let clickedAt = 0;
let panelOpen = false;
let activeAnimation = 'idle';
let frameIndex = 0;
let frameTimer = null;
let clickResetTimer = null;

function getManifest() {
  return petPackage?.manifest || fallbackPackage.manifest;
}

function getAssetBaseUrl() {
  return petPackage?.assetBaseUrl || fallbackPackage.assetBaseUrl;
}

function getAnimationConfig(stateName) {
  return getManifest().states?.[stateName] || getManifest().states.idle;
}

function setPanelOpen(nextOpen) {
  panelOpen = Boolean(nextOpen);
  shell.classList.toggle('panel-open', panelOpen);
  button.setAttribute('aria-expanded', String(panelOpen));
}

function updateStatusText() {
  const status = playbackState?.status || 'idle';
  const trackName = playbackState?.currentTrack?.name || '';
  const summary = statusText[status] || statusText.idle;
  statusEl.textContent = trackName ? `${summary} · ${trackName}` : summary;
  playButton.textContent = status === 'playing' ? '暂停播放' : '播放 / 暂停';
}

function renderCurrentFrame() {
  const manifest = getManifest();
  const config = getAnimationConfig(activeAnimation);
  const frame = config.frames[frameIndex] ?? 0;
  sprite.style.width = `${manifest.assets.frameWidth}px`;
  sprite.style.height = `${manifest.assets.frameHeight}px`;
  sprite.style.backgroundSize = 'auto 100%';
  sprite.style.backgroundPosition = `${-frame * manifest.assets.frameWidth}px 0px`;
}

function restartAnimationLoop() {
  if (frameTimer) {
    clearInterval(frameTimer);
    frameTimer = null;
  }

  const config = getAnimationConfig(activeAnimation);
  frameIndex = 0;
  renderCurrentFrame();

  if (config.frames.length <= 1) return;

  const intervalMs = Math.max(80, Math.round(1000 / config.fps));
  frameTimer = setInterval(() => {
    frameIndex = (frameIndex + 1) % config.frames.length;
    renderCurrentFrame();
  }, intervalMs);
}

function updateAnimation(force = false) {
  const nextAnimation = window.PetAnimationState.resolveAnimationState({
    playbackStatus: playbackState?.status || 'idle',
    hovering,
    clickedAt,
  });

  shell.dataset.animation = nextAnimation;
  if (force || nextAnimation !== activeAnimation) {
    activeAnimation = nextAnimation;
    restartAnimationLoop();
  }
}

function applyPetPackage(nextPackage) {
  petPackage = nextPackage?.manifest ? nextPackage : fallbackPackage;
  const manifest = getManifest();
  const spriteSheetUrl = new URL(manifest.assets.spriteSheet, getAssetBaseUrl()).toString();
  sprite.style.backgroundImage = `url("${spriteSheetUrl}")`;
  updateAnimation(true);
}

function triggerClickState() {
  clickedAt = Date.now();
  clearTimeout(clickResetTimer);
  clickResetTimer = setTimeout(() => updateAnimation(true), window.PetAnimationState.CLICK_STATE_DURATION_MS + 24);
}

function bindActions() {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    triggerClickState();
    setPanelOpen(!panelOpen);
    updateAnimation(true);
  });

  shell.addEventListener('pointerenter', () => {
    hovering = true;
    updateAnimation(true);
  });

  shell.addEventListener('pointerleave', () => {
    hovering = false;
    updateAnimation(true);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#pet-shell')) setPanelOpen(false);
  });

  playButton.addEventListener('click', async () => {
    triggerClickState();
    await petApi?.playPause?.();
  });

  prevButton.addEventListener('click', async () => {
    triggerClickState();
    await petApi?.prev?.();
  });

  nextButton.addEventListener('click', async () => {
    triggerClickState();
    await petApi?.next?.();
  });

  openButton.addEventListener('click', async () => {
    triggerClickState();
    await petApi?.openMainWindow?.();
    setPanelOpen(false);
  });

  quitButton.addEventListener('click', async () => {
    triggerClickState();
    await petApi?.quit?.();
  });
}

async function init() {
  bindActions();

  try {
    const runtimePackage = await petApi?.getPetPackage?.();
    applyPetPackage(runtimePackage);
  } catch (err) {
    console.warn('Pet package load failed, using fallback asset:', err);
    applyPetPackage(fallbackPackage);
  }

  petApi?.onPlaybackState?.((nextState) => {
    playbackState = nextState || { status: 'idle' };
    updateStatusText();
    updateAnimation(true);
  });

  try {
    playbackState = await petApi?.getPlaybackState?.() || { status: 'idle' };
  } catch (err) {
    console.warn('Initial playback state load failed:', err);
    playbackState = { status: 'error' };
  }

  updateStatusText();
  updateAnimation(true);
}

init();
