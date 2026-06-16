const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('musicPet', {
  getPlaybackState: () => ipcRenderer.invoke('playback:get-state'),
  togglePlayback: () => ipcRenderer.invoke('playback:toggle'),
  previous: () => ipcRenderer.invoke('playback:previous'),
  next: () => ipcRenderer.invoke('playback:next'),
  openPlayer: () => ipcRenderer.invoke('player:open'),
  toggleLyric: () => ipcRenderer.invoke('lyric:toggle'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onPlaybackState(callback) {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('playback:state-changed', listener);
    return () => ipcRenderer.removeListener('playback:state-changed', listener);
  },
});
