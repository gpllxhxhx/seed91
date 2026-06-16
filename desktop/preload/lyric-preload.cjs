const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('musicLyric', {
  getPlaybackState: () => ipcRenderer.invoke('playback:get-state'),
  getConfig: () => ipcRenderer.invoke('lyric:get-config'),
  lock: () => ipcRenderer.invoke('lyric:lock'),
  unlock: () => ipcRenderer.invoke('lyric:unlock'),
  onPlaybackState(callback) {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('playback:state-changed', listener);
    return () => ipcRenderer.removeListener('playback:state-changed', listener);
  },
  onLockState(callback) {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('lyric:lock-state', listener);
    return () => ipcRenderer.removeListener('lyric:lock-state', listener);
  },
});
