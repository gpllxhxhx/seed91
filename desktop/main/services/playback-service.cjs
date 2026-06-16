const { EventEmitter } = require('events');

const DEFAULT_STATE = {
  status: 'idle',
  currentTrack: null,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  queue: [],
  currentIndex: -1,
  lyricLines: [],
};

class PlaybackService extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.state = { ...DEFAULT_STATE };
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  updateFromRenderer(nextState) {
    const safeState = {
      ...this.state,
      status: nextState.status || this.state.status,
      currentTrack: nextState.currentTrack || null,
      currentTime: Number(nextState.currentTime || 0),
      duration: Number(nextState.duration || 0),
      volume: Number.isFinite(Number(nextState.volume)) ? Number(nextState.volume) : this.state.volume,
      queue: Array.isArray(nextState.queue) ? nextState.queue : this.state.queue,
      currentIndex: Number.isInteger(nextState.currentIndex) ? nextState.currentIndex : this.state.currentIndex,
      lyricLines: Array.isArray(nextState.lyricLines) ? nextState.lyricLines : this.state.lyricLines,
    };
    this.state = safeState;
    this.emit('state-changed', this.getState());
  }

  setError(message) {
    this.state = { ...this.state, status: 'error', errorMessage: message || '播放错误' };
    this.logger?.warn('playback error', { message });
    this.emit('state-changed', this.getState());
  }

  command(command, payload = {}) {
    this.emit('command', { command, payload });
  }

  play() {
    this.command('play');
  }

  pause() {
    this.command('pause');
  }

  toggle() {
    this.command('toggle');
  }

  next() {
    this.command('next');
  }

  previous() {
    this.command('previous');
  }

  seek(seconds) {
    this.command('seek', { seconds });
  }

  setVolume(volume) {
    this.command('setVolume', { volume });
  }
}

module.exports = { PlaybackService, DEFAULT_STATE };
