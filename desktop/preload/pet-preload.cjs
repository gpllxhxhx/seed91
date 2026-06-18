const { contextBridge, ipcRenderer } = require('electron');

const petAPI = {
  getPlaybackState: () => ipcRenderer.invoke('playback:get-state'),
  getPetPackage: () => ipcRenderer.invoke('pet:get-package'),
  playPause: () => ipcRenderer.invoke('playback:toggle'),
  next: () => ipcRenderer.invoke('playback:next'),
  prev: () => ipcRenderer.invoke('playback:previous'),
  openMainWindow: () => ipcRenderer.invoke('player:open'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onPlaybackState(callback) {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('playback:state-changed', listener);
    return () => ipcRenderer.removeListener('playback:state-changed', listener);
  },
};

const musicPet = {
  getPlaybackState: petAPI.getPlaybackState,
  getPetPackage: petAPI.getPetPackage,
  togglePlayback: petAPI.playPause,
  previous: petAPI.prev,
  next: petAPI.next,
  openPlayer: petAPI.openMainWindow,
  toggleLyric: () => ipcRenderer.invoke('lyric:toggle'),
  quit: petAPI.quit,
  onPlaybackState: petAPI.onPlaybackState,
};

contextBridge.exposeInMainWorld('petAPI', petAPI);
contextBridge.exposeInMainWorld('musicPet', musicPet);
