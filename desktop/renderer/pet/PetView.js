const shell = document.getElementById('pet-shell');
const button = document.getElementById('pet-button');
const statusEl = document.getElementById('pet-status');

const statusText = {
  idle: '空闲',
  loading: '加载中',
  playing: '播放中',
  paused: '已暂停',
  error: '播放错误',
};

function renderState(state) {
  const status = state?.status || 'idle';
  shell.className = `pet-shell ${status}`;
  const track = state?.currentTrack?.name || '';
  statusEl.textContent = track ? `${statusText[status] || status} · ${track}` : (statusText[status] || '空闲');
}

let clickTimer = null;
button.addEventListener('click', () => {
  if (clickTimer) clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    window.musicPet.togglePlayback();
    clickTimer = null;
  }, 180);
});

button.addEventListener('dblclick', () => {
  if (clickTimer) clearTimeout(clickTimer);
  clickTimer = null;
  window.musicPet.openPlayer();
});

window.musicPet.onPlaybackState(renderState);
window.musicPet.getPlaybackState().then(renderState);
