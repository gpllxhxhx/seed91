const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('musicDesktopPlayer', {
  syncPlaybackState: (state) => ipcRenderer.send('player:state-update', state),
  onCommand(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('playback:command', listener);
    return () => ipcRenderer.removeListener('playback:command', listener);
  },
});
