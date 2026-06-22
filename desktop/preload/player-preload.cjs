const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('musicDesktopPlayer', {
  syncPlaybackState: (state) => ipcRenderer.send('player:state-update', state),
  config: {
    get: () => ipcRenderer.invoke('desktop:config:get'),
    update: (patch) => ipcRenderer.invoke('desktop:config:update', patch),
  },
  reportLog: (entry) => ipcRenderer.send('desktop:log:report', entry),
  onCommand(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('playback:command', listener);
    return () => ipcRenderer.removeListener('playback:command', listener);
  },
});
