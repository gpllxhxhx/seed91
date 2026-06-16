const { Menu, Tray, nativeImage } = require('electron');

const TRAY_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR42mP8z8Dwn4ECwESJ5lEDRgYAzj4DHk6F3jQAAAAASUVORK5CYII=';

function createTray({ buildMenu }) {
  const image = nativeImage.createFromDataURL(TRAY_ICON);
  const tray = new Tray(image);
  tray.setToolTip('Music Pet');
  tray.setContextMenu(buildMenu());
  tray.on('click', () => {
    tray.popUpContextMenu(buildMenu());
  });
  return tray;
}

function createAppMenu(actions, state = {}) {
  return Menu.buildFromTemplate([
    {
      label: state.status === 'playing' ? '暂停' : '播放',
      click: () => actions.togglePlayback(),
    },
    { label: '上一首', click: () => actions.previous() },
    { label: '下一首', click: () => actions.next() },
    { type: 'separator' },
    {
      label: state.lyricVisible ? '隐藏桌面歌词' : '显示桌面歌词',
      click: () => actions.toggleLyric(),
    },
    {
      label: state.lyricLocked ? '解锁歌词位置' : '锁定歌词位置',
      click: () => actions.toggleLyricLock(),
    },
    { type: 'separator' },
    { label: '打开播放器', click: () => actions.openPlayer() },
    { label: '退出', click: () => actions.quit() },
  ]);
}

module.exports = { createTray, createAppMenu };
