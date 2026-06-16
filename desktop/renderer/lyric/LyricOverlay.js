const shell = document.getElementById('lyric-shell');
const lineEl = document.getElementById('lyric-line');
const lockButton = document.getElementById('lyric-lock');

function currentLyricLine(lines, currentTime) {
  if (!Array.isArray(lines) || !lines.length) return '暂无歌词';
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (currentTime >= Number(lines[index].time || 0)) return lines[index].text || '...';
  }
  return lines[0]?.text || '暂无歌词';
}

function renderState(state) {
  if (!state || state.status === 'idle') {
    lineEl.textContent = '暂无歌词';
    return;
  }
  lineEl.textContent = currentLyricLine(state.lyricLines, Number(state.currentTime || 0));
}

function applyConfig(config = {}) {
  document.documentElement.style.setProperty('--lyric-font-size', `${Number(config.fontSize || 34)}px`);
  document.documentElement.style.setProperty('--lyric-color', config.color || '#ffffff');
  shell.classList.toggle('locked', Boolean(config.locked));
  lockButton.textContent = config.locked ? '解锁' : '锁定';
}

lockButton.addEventListener('click', async () => {
  const config = await window.musicLyric.getConfig();
  if (config.locked) await window.musicLyric.unlock();
  else await window.musicLyric.lock();
});

window.musicLyric.onPlaybackState(renderState);
window.musicLyric.onLockState((payload) => applyConfig(payload.config));
window.musicLyric.getPlaybackState().then(renderState);
window.musicLyric.getConfig().then(applyConfig);
