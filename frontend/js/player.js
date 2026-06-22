 d/* ===== Music Player Controller ===== */
const PLAYER_MODE_KEY = 'music-player:play-mode:v1';
const PLAYER_VOLUME_KEY = 'music-player:volume:v1';
const PLAY_MODES = ['list-loop', 'single-loop', 'shuffle'];
const PLAY_MODE_META = {
    'list-loop': { icon: 'repeat', title: '列表循环', toast: '列表循环' },
    'single-loop': { icon: 'repeat-1', title: '单曲循环', toast: '单曲循环' },
    shuffle: { icon: 'shuffle', title: '随机播放', toast: '随机播放' },
};

const Player = {
    audio: null,
    playlist: [],
    currentIndex: -1,
    isPlaying: false,
    currentSong: null,
    isDragging: false,
    progressAnimationFrame: null,
    playMode: localStorage.getItem(PLAYER_MODE_KEY) || 'list-loop',
    isLoadingSong: false,
    currentRequestId: 0,
    retryingPlayback: false,
    currentAudioLevel: 'quality',
    currentAudioUrl: '',
    currentSourceIndex: 0,
    currentSourceCount: 0,
    lyrics: [],
    hasTimedLyrics: false,
    activeLyricIndex: -1,
    lyricsRequestId: 0,
    commentsRequestId: 0,
    detailLyricsVisible: false,
    lastNonZeroVolume: 80,
    desktopConfigCache: null,

    async init() {
        this.audio = document.getElementById('audio-player');
        this.progressBar = document.getElementById('player-progress-bar');
        this.volumeSlider = document.getElementById('player-volume');
        this.qualitySelect = document.getElementById('player-quality-select');
        if (!this.audio) return;

        if (!PLAY_MODES.includes(this.playMode)) this.playMode = 'list-loop';
        this.desktopConfigCache = await this.readDesktopConfig();
        const storedVolume = Number(localStorage.getItem(PLAYER_VOLUME_KEY));
        const desktopVolume = Number(this.desktopConfigCache?.player?.volume);
        const volume = Number.isFinite(desktopVolume)
            ? Math.round(Math.max(0, Math.min(1, desktopVolume)) * 100)
            : (Number.isFinite(storedVolume) ? Math.max(0, Math.min(100, storedVolume)) : Number(this.volumeSlider?.value || 80));
        if (volume > 0) this.lastNonZeroVolume = volume;
        this.audio.muted = Boolean(this.desktopConfigCache?.player?.muted) || volume <= 0;
        this.audio.volume = volume / 100;
        if (this.volumeSlider) this.volumeSlider.value = volume;
        localStorage.setItem(PLAYER_VOLUME_KEY, String(volume));

        this.updateProgressUI(0, 0, 0);
        this.updateRangeFill(this.volumeSlider, volume);
        this.updateVolumeUI();
        this.updatePlayModeUI();
        this.renderLyrics('未在播放');
        this.bindEvents();
        this.initDesktopBridge();
        this.restoreLastSongFromDesktopConfig();
        this.publishDesktopState(true);
    },

    async readDesktopConfig() {
        try {
            return await window.musicDesktopPlayer?.config?.get?.() || null;
        } catch (err) {
            this.reportLog('warn', 'desktop config read failed', { reason: err?.message || String(err) });
            return null;
        }
    },

    async updateDesktopConfig(patch) {
        if (!patch || typeof patch !== 'object') return;
        try {
            this.desktopConfigCache = await window.musicDesktopPlayer?.config?.update?.(patch) || this.desktopConfigCache;
        } catch (err) {
            this.reportLog('warn', 'desktop config update failed', {
                patch,
                reason: err?.message || String(err),
            });
        }
    },

    reportLog(level, message, meta = {}) {
        try {
            window.musicDesktopPlayer?.reportLog?.({
                level,
                message,
                scope: 'player',
                meta,
            });
        } catch (err) {
            console.warn('Desktop player log report failed:', err);
        }
    },

    notify(message, type = 'success') {
        if (typeof window.notifyUser === 'function') {
            window.notifyUser(message, type);
            return;
        }
        if (typeof showToast === 'function') showToast(message, type);
    },

    restoreLastSongFromDesktopConfig() {
        const lastSong = this.desktopConfigCache?.player?.lastSong;
        if (!lastSong || !lastSong.songId) return;

        this.currentSong = {
            id: Number(lastSong.songId),
            song_id: String(lastSong.songId),
            name: lastSong.songName || '未在播放',
            artists: [{ name: lastSong.artist || '未知艺术家' }],
            ar: [{ name: lastSong.artist || '未知艺术家' }],
            coverUrl: lastSong.cover || '',
            album_cover: lastSong.cover || '',
        };
        this.setCurrentSongUI(this.currentSong);
        this.setPlayerStatus('已恢复上次歌曲信息');
        this.renderLyrics('未自动播放');
    },

    buildPersistedLastSong(song, progress = 0) {
        const normalized = API.normalizeSong ? API.normalizeSong(song) || song : song;
        if (!normalized) return null;
        return {
            songId: normalized.id || normalized.song_id || null,
            songName: normalized.name || '未知歌曲',
            artist: this._getArtistText(normalized),
            cover: normalizePlayerImageUrl(normalized.coverUrl || normalized.album_cover || ''),
            progress: Number.isFinite(progress) ? progress : 0,
        };
    },

    bindEvents() {
        this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.audio.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
        this.audio.addEventListener('durationchange', () => this.onLoadedMetadata());
        this.audio.addEventListener('ended', () => this.onEnded());
        this.audio.addEventListener('play', () => this.onPlayStateChange(true));
        this.audio.addEventListener('pause', () => this.onPlayStateChange(false));
        this.audio.addEventListener('error', (event) => this.onError(event));

        document.getElementById('btn-play-pause')?.addEventListener('click', () => this.togglePlay());
        document.getElementById('btn-prev')?.addEventListener('click', () => this.prev());
        document.getElementById('btn-next')?.addEventListener('click', () => this.next());
        document.getElementById('btn-play-mode')?.addEventListener('click', () => this.togglePlayMode());

        this.progressBar?.addEventListener('pointerdown', () => { this.isDragging = true; });
        this.progressBar?.addEventListener('input', () => this.previewSeek());
        this.progressBar?.addEventListener('change', () => this.commitSeek());
        this.progressBar?.addEventListener('pointerup', () => this.commitSeek());
        this.progressBar?.addEventListener('blur', () => {
            if (this.isDragging) this.commitSeek();
        });

        this.volumeSlider?.addEventListener('input', () => {
            const volume = Number(this.volumeSlider.value);
            this.audio.volume = volume / 100;
            this.audio.muted = volume <= 0;
            if (volume > 0) this.lastNonZeroVolume = volume;
            localStorage.setItem(PLAYER_VOLUME_KEY, String(volume));
            this.updateRangeFill(this.volumeSlider, volume);
            this.updateVolumeUI();
            this.updateDesktopConfig({
                player: {
                    volume: volume / 100,
                    muted: this.audio.muted,
                },
            });
            this.publishDesktopState(true);
        });

        document.getElementById('btn-toggle-mute')?.addEventListener('click', () => this.toggleMute());

        this.qualitySelect?.addEventListener('change', () => {
            if (this.currentSong) this.loadSong(this.currentSong);
        });

        document.getElementById('btn-toggle-playlist')?.addEventListener('click', () => {
            document.getElementById('queue-panel')?.classList.toggle('hidden');
            document.getElementById('comments-panel')?.classList.add('hidden');
        });
        document.getElementById('btn-locate-current-song')?.addEventListener('click', () => this.locateCurrentQueueSong());

        document.getElementById('btn-add-current-to-playlist')?.addEventListener('click', () => this.addCurrentSongToPlaylist());

        document.getElementById('btn-toggle-comments')?.addEventListener('click', () => this.toggleCommentsPanel());
        document.addEventListener('click', (event) => {
            const panel = document.getElementById('queue-panel');
            if (!panel || panel.classList.contains('hidden')) return;
            if (event.target.closest('#queue-panel, #btn-toggle-playlist')) return;
            panel.classList.add('hidden');
        });
        document.addEventListener('click', (event) => {
            const panel = document.getElementById('comments-panel');
            if (!panel || panel.classList.contains('hidden')) return;
            if (event.target.closest('#comments-panel, #btn-toggle-comments')) return;
            panel.classList.add('hidden');
        });

        document.getElementById('current-song-visual')?.addEventListener('click', () => this.toggleCurrentDetailLyrics());
        document.getElementById('btn-current-song-toggle-lyrics')?.addEventListener('click', () => this.toggleCurrentDetailLyrics());
        document.getElementById('btn-current-song-play')?.addEventListener('click', () => this.togglePlay());
        document.getElementById('btn-current-song-add')?.addEventListener('click', () => {
            this.addCurrentSongToPlaylist();
        });

        window.addEventListener('resize', () => this.updateTitleMarquee());
    },

    onPlayStateChange(playing) {
        this.isPlaying = playing;
        this.setTurntablePlaying(playing);
        document.getElementById('player-bar')?.classList.toggle('playing', playing);
        const iconEl = document.getElementById('icon-play-pause');
        if (iconEl) {
            iconEl.setAttribute('data-lucide', playing ? 'pause' : 'play');
            lucide.createIcons();
        }
        if (playing) this.startProgressAnimation();
        else this.stopProgressAnimation();
        if (!playing) {
            this.updateDesktopConfig({
                player: {
                    muted: Boolean(this.audio?.muted),
                    volume: Number(this.audio?.volume || 0),
                    lastSong: this.buildPersistedLastSong(this.currentSong, Number(this.audio?.currentTime || 0)),
                },
            });
        }
        this.updateCurrentDetailPlayIcon();
        this.publishDesktopState(true);
    },

    onTimeUpdate() {
        if (this.isDragging || !this.audio.duration || Number.isNaN(this.audio.duration)) return;
        this.updateProgressUI(this.audio.currentTime, this.audio.duration);
    },

    onLoadedMetadata() {
        const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
        this.updateProgressUI(this.audio.currentTime || 0, duration);
    },

    onEnded() {
        if (this.playMode === 'single-loop' && this.currentSong) {
            this.loadSong(this.currentSong);
            return;
        }
        this.next();
    },

    onError(event) {
        console.error('Audio playback error:', event);
        this.reportLog('error', 'audio element playback error', {
            songId: this.currentSong?.id || this.currentSong?.song_id || null,
            readyState: this.audio?.readyState,
            networkState: this.audio?.networkState,
        });
        if (this.isLoadingSong) return;
        if (!this.currentSong || this.retryingPlayback) {
            this.showPlaybackFailed();
            return;
        }
        this.recoverPlayback('当前音源无法播放，正在切换下一个音源...');
    },

    async loadSong(song, options = {}) {
        const selectedLevel = this.qualitySelect?.value || 'quality';
        const normalized = API.normalizeSong ? API.normalizeSong(song) || song : song;
        const songId = normalized?.song_id || normalized?.id;
        const requestId = ++this.currentRequestId;

        this.currentSong = normalized;
        this.currentAudioLevel = selectedLevel;
        this.currentAudioUrl = '';
        this.playbackError = false;
        this.retryingPlayback = Boolean(options.retrying);
        if (!options.retrying) this.detailLyricsVisible = false;
        if (!options.retrying) {
            this.currentSourceIndex = 0;
            this.currentSourceCount = 0;
        }
        this.isLoadingSong = true;
        this.setCurrentSongUI(this.currentSong);
        this.resetPlaybackState();
        this.updateDesktopConfig({
            player: {
                lastSong: this.buildPersistedLastSong(this.currentSong, 0),
            },
        });
        this.publishDesktopState(true);
        this.loadLyrics(songId);
        if (!document.getElementById('comments-panel')?.classList.contains('hidden')) {
            this.loadComments(songId);
        }

        try {
            if (!songId) throw new Error('歌曲 ID 无效');
            if (!options.silent) this.setPlayerStatus('正在获取音源...');
            const audio = await API.getPlayableAudio(songId, selectedLevel, {
                startIndex: options.sourceStartIndex || 0,
                song: normalized,
            });
            if (requestId !== this.currentRequestId) return;

            this.currentAudioUrl = audio.audio_url;
            this.currentSourceIndex = Number.isFinite(audio.sourceIndex) ? audio.sourceIndex : 0;
            this.currentSourceCount = Number.isFinite(audio.sourceCount) ? audio.sourceCount : this.currentSourceCount;
            this.audio.src = audio.audio_url;
            this.audio.load();
            const played = await this.playLoadedAudio();
            if (requestId !== this.currentRequestId) return;
            if (played) this.setPlayerStatus('');
            this.reportLog('info', 'song audio url resolved', {
                songId,
                source: audio.source || '',
                retrying: Boolean(options.retrying),
            });
            if (played) {
                this.updateDesktopConfig({
                    player: {
                        lastSong: this.buildPersistedLastSong(this.currentSong, Number(this.audio?.currentTime || 0)),
                    },
                });
            }
            if (played) {
                const sourceText = audio.source ? `（${audio.source}）` : '';
                this.notify(options.retrying ? `已切换音源${sourceText}` : `已获取播放地址${sourceText}`);
            }
        } catch (err) {
            if (requestId !== this.currentRequestId) return;
            console.error('Load audio URL failed:', err);
            this.reportLog('error', 'song audio url load failed', {
                songId,
                songName: normalized?.name || '',
                retrying: Boolean(options.retrying),
                reason: err?.message || String(err),
            });
            this.playbackError = true;
            this.isPlaying = false;
            this.clearAudioSource();
            const message = options.retrying
                ? '当前歌曲暂时无法播放，已停止播放。'
                : (String(err?.message || '').includes('无法连接 API 后端')
                    ? '网络连接失败，请检查网络后重试。'
                    : '当前歌曲暂时无法播放，已停止播放。');
            this.notify(message, 'error');
            this.setPlayerStatus(message);
            this.publishDesktopState(true);
        } finally {
            if (requestId === this.currentRequestId) {
                this.isLoadingSong = false;
                this.retryingPlayback = false;
                this.publishDesktopState(true);
            }
        }
    },

    async playLoadedAudio() {
        try {
            await this.audio.play();
            return true;
        } catch (err) {
            if (err?.name === 'NotAllowedError') {
                this.setPlayerStatus('浏览器已阻止自动播放，点击播放继续');
                this.reportLog('warn', 'audio playback blocked', {
                    songId: this.currentSong?.id || this.currentSong?.song_id || null,
                    reason: err?.message || String(err),
                });
                this.notify('当前歌曲已准备好，点击播放按钮继续。', 'error');
                console.warn('Auto-play blocked:', err);
                return false;
            }
            if (!this.retryingPlayback) {
                await this.recoverPlayback('当前音源无法播放，正在切换下一个音源...');
                return false;
            }
            throw err;
        }
    },

    async recoverPlayback(message) {
        const nextSourceIndex = this.currentSourceIndex + 1;
        const sourceCount = this.currentSourceCount || 0;
        if (!this.currentSong || this.retryingPlayback || nextSourceIndex >= sourceCount) {
            this.showPlaybackFailed();
            return;
        }
        this.retryingPlayback = true;
        this.notify(message);
        await this.loadSong(this.currentSong, { retrying: true, silent: true, sourceStartIndex: nextSourceIndex });
    },

    showPlaybackFailed() {
        this.isPlaying = false;
        this.playbackError = true;
        this.stopProgressAnimation();
        this.clearAudioSource();
        this.reportLog('error', 'song playback failed', {
            songId: this.currentSong?.id || this.currentSong?.song_id || null,
            songName: this.currentSong?.name || '',
        });
        this.setPlayerStatus('当前歌曲暂时无法播放，已停止播放。');
        this.notify('当前歌曲暂时无法播放，已停止播放。', 'error');
        this.publishDesktopState(true);
    },

    playSong(song) {
        this.playlist = [song];
        this.currentIndex = 0;
        this.renderQueue();
        this.loadSong(song);
    },

    async playPlaylist(songs, startIndex = 0) {
        this.playlist = songs || [];
        this.currentIndex = Math.max(0, Math.min(startIndex, this.playlist.length - 1));
        this.renderQueue();
        if (this.playlist.length > 0) this.loadSong(this.playlist[this.currentIndex]);
    },

    async playSongList(songs, startId) {
        this.playlist = songs || [];
        const targetId = Number(startId);
        const index = this.playlist.findIndex((song) => Number(song.id || song.song_id) === targetId);
        this.currentIndex = index >= 0 ? index : 0;
        this.renderQueue();
        if (this.playlist.length > 0) this.loadSong(this.playlist[this.currentIndex]);
    },

    togglePlay() {
        if (!this.audio.src) {
            if (this.currentSong) this.loadSong(this.currentSong);
            return;
        }
        if (this.isPlaying) {
            this.audio.pause();
        } else {
            this.audio.play().catch((err) => {
                console.warn('Play failed:', err);
                this.reportLog('error', 'resume playback failed', {
                    songId: this.currentSong?.id || this.currentSong?.song_id || null,
                    reason: err?.message || String(err),
                });
                this.recoverPlayback('播放失败，正在重新获取音源...');
            });
        }
    },

    next() {
        if (!this.playlist.length) return;
        this.currentIndex = this.getNextIndex();
        this.renderQueue();
        this.loadSong(this.playlist[this.currentIndex]);
    },

    prev() {
        if (!this.playlist.length) return;
        if (this.playMode === 'shuffle') {
            this.currentIndex = this.getRandomNextIndex();
        } else {
            this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        }
        this.renderQueue();
        this.loadSong(this.playlist[this.currentIndex]);
    },

    getNextIndex() {
        if (this.playMode === 'shuffle') return this.getRandomNextIndex();
        return (this.currentIndex + 1) % this.playlist.length;
    },

    getRandomNextIndex() {
        if (this.playlist.length <= 1) return 0;
        let nextIndex = this.currentIndex;
        while (nextIndex === this.currentIndex) {
            nextIndex = Math.floor(Math.random() * this.playlist.length);
        }
        return nextIndex;
    },

    removeFromQueue(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.playlist.length) return;
        const removingCurrent = index === this.currentIndex;
        this.playlist.splice(index, 1);

        if (!this.playlist.length) {
            this.stopPlayback();
            this.renderQueue();
            return;
        }

        if (removingCurrent) {
            this.currentIndex = Math.min(index, this.playlist.length - 1);
            this.renderQueue();
            this.loadSong(this.playlist[this.currentIndex]);
            return;
        }

        if (index < this.currentIndex) this.currentIndex -= 1;
        this.renderQueue();
    },

    stopPlayback() {
        this.currentIndex = -1;
        this.currentSong = null;
        this.playbackError = false;
        this.clearAudioSource();
        this.resetPlaybackState();
        this.setCurrentSongUI(null);
        this.renderLyrics('未在播放');
        this.publishDesktopState(true);
    },

    seekTo(seconds) {
        if (this.audio.src && Number.isFinite(seconds)) {
            this.audio.currentTime = seconds;
            const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
            this.updateProgressUI(seconds, duration);
        }
    },

    previewSeek() {
        if (!this.progressBar) return;
        this.isDragging = true;
        const progress = Number(this.progressBar.value);
        const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
        const previewTime = duration ? (progress / 100) * duration : 0;
        this.updateProgressUI(previewTime, duration, progress);
    },

    commitSeek() {
        if (!this.progressBar) return;
        const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
        const progress = Number(this.progressBar.value);
        const seconds = duration ? (progress / 100) * duration : 0;
        this.isDragging = false;
        this.seekTo(seconds);
    },

    startProgressAnimation() {
        if (this.progressAnimationFrame) return;
        const tick = () => {
            if (!this.isDragging && this.audio && Number.isFinite(this.audio.duration)) {
                this.updateProgressUI(this.audio.currentTime, this.audio.duration);
            }
            this.progressAnimationFrame = this.isPlaying ? requestAnimationFrame(tick) : null;
        };
        this.progressAnimationFrame = requestAnimationFrame(tick);
    },

    stopProgressAnimation() {
        if (!this.progressAnimationFrame) return;
        cancelAnimationFrame(this.progressAnimationFrame);
        this.progressAnimationFrame = null;
    },

    updateProgressUI(currentTime = 0, duration = 0, explicitProgress = null) {
        const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
        const safeTime = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
        const progress = explicitProgress ?? (safeDuration ? Math.min(100, (safeTime / safeDuration) * 100) : 0);

        if (this.progressBar) {
            this.progressBar.value = progress;
            this.updateRangeFill(this.progressBar, progress);
        }

        const timeEl = document.getElementById('player-current-time');
        if (timeEl) timeEl.textContent = this.formatTime(safeTime);

        const durationEl = document.getElementById('player-duration');
        if (durationEl) durationEl.textContent = safeDuration ? this.formatTime(safeDuration) : '00:00';

        this.updateActiveLyrics(safeTime);
        this.publishDesktopState();
    },

    updateRangeFill(range, value) {
        if (!range) return;
        const min = Number(range.min || 0);
        const max = Number(range.max || 100);
        const percent = max === min ? 0 : ((Number(value) - min) / (max - min)) * 100;
        range.style.setProperty('--range-progress', `${Math.max(0, Math.min(100, percent))}%`);
    },

    toggleMute() {
        if (!this.audio) return;
        const currentVolume = Number(this.volumeSlider?.value || 0);
        if (this.audio.muted || currentVolume <= 0) {
            const storedVolume = Number(localStorage.getItem(PLAYER_VOLUME_KEY));
            const restoredVolume = this.lastNonZeroVolume || (Number.isFinite(storedVolume) && storedVolume > 0 ? storedVolume : 80);
            this.audio.muted = false;
            this.audio.volume = Math.max(0, Math.min(100, restoredVolume)) / 100;
            if (this.volumeSlider) {
                this.volumeSlider.value = Math.round(this.audio.volume * 100);
                this.updateRangeFill(this.volumeSlider, Number(this.volumeSlider.value));
            }
            localStorage.setItem(PLAYER_VOLUME_KEY, String(Math.round(this.audio.volume * 100)));
        } else {
            if (currentVolume > 0) this.lastNonZeroVolume = currentVolume;
            this.audio.muted = true;
        }
        this.updateVolumeUI();
        this.updateDesktopConfig({
            player: {
                volume: Number(this.audio.volume || 0),
                muted: Boolean(this.audio.muted) || Number(this.volumeSlider?.value || 0) <= 0,
                lastSong: this.buildPersistedLastSong(this.currentSong, Number(this.audio?.currentTime || 0)),
            },
        });
        this.publishDesktopState(true);
    },

    updateVolumeUI() {
        const button = document.getElementById('btn-toggle-mute');
        const icon = document.getElementById('icon-volume');
        const volume = Number(this.volumeSlider?.value || 0);
        const muted = Boolean(this.audio?.muted) || volume <= 0;
        const iconName = muted ? 'volume-x' : (volume < 45 ? 'volume-1' : 'volume-2');

        button?.classList.toggle('active', muted);
        if (button) button.title = muted ? '取消静音' : '静音';
        if (icon) {
            icon.setAttribute('data-lucide', iconName);
            lucide.createIcons();
        }
    },

    resetPlaybackState() {
        this.isDragging = false;
        this.stopProgressAnimation();
        this.updateProgressUI(0, 0, 0);
        this.setPlayIcon(false);
        this.setPlayerStatus('正在加载...');
    },

    clearAudioSource() {
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
        this.currentAudioUrl = '';
        this.isPlaying = false;
        this.setPlayIcon(false);
    },

    setPlayIcon(playing) {
        this.setTurntablePlaying(playing);
        const iconEl = document.getElementById('icon-play-pause');
        if (iconEl) {
            iconEl.setAttribute('data-lucide', playing ? 'pause' : 'play');
            lucide.createIcons();
        }
        this.updateCurrentDetailPlayIcon();
    },

    setTurntablePlaying(playing) {
        const isPlaying = Boolean(playing);
        document.body.classList.toggle('current-song-is-playing', isPlaying);
        document.querySelector('.tonearm')?.classList.toggle('is-playing', isPlaying);
    },

    setPlayerStatus(status) {
        const artistEl = document.getElementById('player-artist');
        if (!artistEl) return;
        artistEl.textContent = this.sanitizeVisibleCopy(status || this._getArtistText(this.currentSong));
    },

    setCurrentSongUI(song) {
        const titleEl = document.getElementById('player-title');
        const titleTextEl = document.getElementById('player-title-text');
        const artistEl = document.getElementById('player-artist');
        const coverEl = document.getElementById('player-cover');
        if (titleTextEl) {
            titleTextEl.textContent = this.sanitizeVisibleCopy(song?.name || '未在播放');
            requestAnimationFrame(() => this.updateTitleMarquee());
        } else if (titleEl) {
            titleEl.textContent = this.sanitizeVisibleCopy(song?.name || '未在播放');
        }
        if (artistEl) artistEl.textContent = song ? this.sanitizeVisibleCopy(this._getArtistText(song)) : '';
        if (coverEl) {
            const coverUrl = normalizePlayerImageUrl(song?.coverUrl || song?.album_cover || song?.album?.picUrl || song?.al?.picUrl || '');
            coverEl.dataset.fallbackApplied = '';
            if (coverUrl) {
                coverEl.classList.remove('is-broken', 'artwork-empty');
                coverEl.src = withPlayerImageSize(coverUrl, 120);
            } else {
                coverEl.removeAttribute('src');
                coverEl.classList.add('artwork-empty');
            }
        }
        this.renderCurrentDetail();
    },

    updateTitleMarquee() {
        const titleEl = document.getElementById('player-title');
        const titleTextEl = document.getElementById('player-title-text');
        if (!titleEl || !titleTextEl) return;
        const overflow = titleTextEl.scrollWidth > titleEl.clientWidth + 2;
        titleTextEl.classList.toggle('is-marquee', overflow);
        titleTextEl.style.setProperty('--title-scroll-distance', overflow ? `${titleTextEl.scrollWidth - titleEl.clientWidth + 42}px` : '0px');
    },

    togglePlayMode() {
        const current = PLAY_MODES.indexOf(this.playMode);
        this.playMode = PLAY_MODES[(current + 1) % PLAY_MODES.length];
        localStorage.setItem(PLAYER_MODE_KEY, this.playMode);
        this.updatePlayModeUI();
        if (typeof showToast === 'function') showToast(`播放模式：${PLAY_MODE_META[this.playMode].toast}`);
    },

    updatePlayModeUI() {
        const meta = PLAY_MODE_META[this.playMode] || PLAY_MODE_META['list-loop'];
        const btn = document.getElementById('btn-play-mode');
        const icon = document.getElementById('icon-play-mode');
        if (btn) {
            btn.title = meta.title;
            btn.classList.toggle('active', this.playMode !== 'list-loop');
        }
        if (icon) icon.setAttribute('data-lucide', meta.icon);
        lucide.createIcons();
    },

    initDesktopBridge() {
        if (!window.musicDesktopPlayer || this.desktopBridgeReady) return;
        this.desktopBridgeReady = true;
        window.musicDesktopPlayer.onCommand(({ command, payload } = {}) => {
            if (command === 'toggle') this.togglePlay();
            if (command === 'play' && !this.isPlaying) this.togglePlay();
            if (command === 'pause' && this.isPlaying) this.togglePlay();
            if (command === 'next') this.next();
            if (command === 'previous') this.prev();
            if (command === 'seek') this.seekTo(Number(payload?.seconds || 0));
            if (command === 'setVolume') {
                const volume = Math.max(0, Math.min(1, Number(payload?.volume || 0)));
                this.audio.volume = volume;
                this.audio.muted = volume <= 0;
                if (this.volumeSlider) {
                    this.volumeSlider.value = Math.round(volume * 100);
                    this.updateRangeFill(this.volumeSlider, Number(this.volumeSlider.value));
                }
                this.updateVolumeUI();
                this.updateDesktopConfig({
                    player: {
                        volume,
                        muted: this.audio.muted,
                    },
                });
                this.publishDesktopState(true);
            }
        });
    },

    publishDesktopState(force = false) {
        if (!window.musicDesktopPlayer?.syncPlaybackState || !this.audio) return;
        const now = Date.now();
        if (!force && this.lastDesktopSyncAt && now - this.lastDesktopSyncAt < 250) return;
        this.lastDesktopSyncAt = now;
        window.musicDesktopPlayer.syncPlaybackState(this.buildDesktopPlaybackState());
    },

    buildDesktopPlaybackState() {
        const status = this.isLoadingSong
            ? 'loading'
            : (this.playbackError ? 'error' : (!this.currentSong ? 'idle' : (this.isPlaying ? 'playing' : 'paused')));
        return {
            status,
            currentTrack: this.toDesktopTrack(this.currentSong),
            currentTime: Number(this.audio?.currentTime || 0),
            duration: Number.isFinite(this.audio?.duration) ? Number(this.audio.duration) : 0,
            volume: Number(this.audio?.volume || 0),
            muted: Boolean(this.audio?.muted),
            queue: this.playlist.map((song) => this.toDesktopTrack(song)).filter(Boolean),
            currentIndex: this.currentIndex,
            lyricLines: this.hasTimedLyrics
                ? this.lyrics.map((line) => ({ time: line.time, text: line.text }))
                : this.lyrics.slice(0, 1).map((line) => ({ time: 0, text: line.text })),
        };
    },

    toDesktopTrack(song) {
        const normalized = API.normalizeSong ? API.normalizeSong(song) || song : song;
        if (!normalized) return null;
        return {
            id: normalized.id || normalized.song_id,
            name: normalized.name || '未知歌曲',
            artists: this._getArtistText(normalized),
            coverUrl: normalizePlayerImageUrl(normalized.coverUrl || normalized.album_cover || ''),
        };
    },

    async loadLyrics(songId) {
        const requestId = ++this.lyricsRequestId;
        this.lyrics = [];
        this.hasTimedLyrics = false;
        this.activeLyricIndex = -1;
        this.renderLyrics('歌词加载中...');
        if (!songId || !API.getSongLyrics) {
            this.renderLyrics('暂无歌词');
            this.publishDesktopState(true);
            return;
        }

        try {
            const lyrics = await API.getSongLyrics(songId);
            if (requestId !== this.lyricsRequestId) return;
            const lyricText = lyrics?.lrc?.lyric || '';
            const parsed = this.parseLyrics(lyricText);
            this.lyrics = parsed.lines;
            this.hasTimedLyrics = parsed.hasTimedLyrics;
            this.renderLyrics(this.lyrics.length ? '' : '暂无歌词');
            this.publishDesktopState(true);
        } catch (err) {
            if (requestId !== this.lyricsRequestId) return;
            console.warn('Lyrics load failed:', err);
            this.lyrics = [];
            this.hasTimedLyrics = false;
            this.renderLyrics('暂无歌词');
            this.publishDesktopState(true);
        }
    },

    toggleCommentsPanel() {
        const panel = document.getElementById('comments-panel');
        if (!panel) return;
        if (!this.currentSong) {
            if (typeof showToast === 'function') showToast('还没有正在播放的歌曲', 'error');
            return;
        }

        const willOpen = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !willOpen);
        document.getElementById('queue-panel')?.classList.add('hidden');
        if (willOpen) {
            this.loadComments(this.currentSong.id || this.currentSong.song_id);
        }
    },

    addCurrentSongToPlaylist() {
        if (!this.currentSong) {
            if (typeof showToast === 'function') showToast('还没有正在播放的歌曲', 'error');
            return;
        }
        if (typeof showPlaylistPicker !== 'function') return;
        document.getElementById('queue-panel')?.classList.add('hidden');
        document.getElementById('comments-panel')?.classList.add('hidden');
        showPlaylistPicker(this.currentSong, '添加');
    },

    async loadComments(songId) {
        const requestId = ++this.commentsRequestId;
        const status = document.getElementById('comments-status');
        const body = document.getElementById('comments-panel-body');
        if (!body) return;

        if (status) status.textContent = '加载中';
        body.innerHTML = '<div class="comments-empty">评论加载中...</div>';
        if (!songId || !API.getSongComments) {
            if (status) status.textContent = '暂无评论';
            body.innerHTML = '<div class="comments-empty">暂无评论</div>';
            return;
        }

        try {
            const data = await API.getSongComments(songId, 30, 0);
            if (requestId !== this.commentsRequestId) return;
            const comments = [...(data.hotComments || []), ...(data.comments || [])];
            this.renderComments(comments);
        } catch (err) {
            if (requestId !== this.commentsRequestId) return;
            console.warn('Comments load failed:', err);
            if (status) status.textContent = '加载失败';
            body.innerHTML = '<div class="comments-empty">评论加载失败</div>';
        }
    },

    renderComments(comments = []) {
        const status = document.getElementById('comments-status');
        const body = document.getElementById('comments-panel-body');
        if (!body) return;

        if (!comments.length) {
            if (status) status.textContent = '暂无评论';
            body.innerHTML = '<div class="comments-empty">暂无评论</div>';
            return;
        }

        if (status) status.textContent = '可阅读';
        body.innerHTML = comments.map((comment) => {
            const user = comment.user || {};
            const avatar = user.avatarUrl || '';
            const name = user.nickname || '匿名用户';
            const time = comment.timeStr || this.formatCommentTime(comment.time);
            const liked = Number(comment.likedCount || 0);
            const likedText = liked > 0 ? `<span><i data-lucide="heart"></i>${this.formatCompactNumber(liked)}</span>` : '';
            return `
                <article class="comment-item">
                    ${avatar
                        ? `<img class="comment-avatar" src="${this.escapeAttribute(withPlayerImageSize(normalizePlayerImageUrl(avatar), 80))}" alt="">`
                        : '<div class="comment-avatar comment-avatar-empty"><i data-lucide="user"></i></div>'
                    }
                    <div class="comment-main">
                        <div class="comment-meta">
                            <strong>${this.escapeHtml(name)}</strong>
                            <span>${this.escapeHtml(time)}</span>
                        </div>
                        <p>${this.escapeHtml(comment.content || '')}</p>
                        <div class="comment-actions">${likedText}</div>
                    </div>
                </article>
            `;
        }).join('');
        lucide.createIcons();
        this.publishDesktopState(true);
    },

    formatCommentTime(value) {
        const time = Number(value || 0);
        if (!time) return '';
        const date = new Date(time);
        if (Number.isNaN(date.getTime())) return '';
        const now = Date.now();
        const diff = now - date.getTime();
        if (diff >= 0 && diff < 86400000) return '今天';
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    },

    formatCompactNumber(value) {
        const number = Number(value || 0);
        if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万`;
        return String(number);
    },

    parseLyrics(rawLyrics) {
        const rows = String(rawLyrics || '').split(/\r?\n/);
        const timedLines = [];
        const plainLines = [];
        const timePattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

        rows.forEach((row) => {
            const matches = [...row.matchAll(timePattern)];
            const text = row.replace(timePattern, '').trim();
            if (!matches.length) {
                if (row.trim()) plainLines.push({ time: null, text: row.trim() });
                return;
            }
            matches.forEach((match) => {
                const minutes = Number(match[1]);
                const seconds = Number(match[2]);
                const fraction = Number((match[3] || '0').padEnd(3, '0'));
                timedLines.push({
                    time: minutes * 60 + seconds + fraction / 1000,
                    text: text || '...',
                });
            });
        });

        if (timedLines.length) {
            return {
                hasTimedLyrics: true,
                lines: timedLines.sort((a, b) => a.time - b.time),
            };
        }

        return {
            hasTimedLyrics: false,
            lines: plainLines,
        };
    },

    renderLyrics(fallbackText = '') {
        if (!this.lyrics.length) {
            this.renderCurrentDetailLyrics(fallbackText || '暂无歌词');
            return;
        }

        this.activeLyricIndex = this.hasTimedLyrics ? -1 : 0;
        this.renderCurrentDetailLyrics();
    },

    updateActiveLyrics(currentTime) {
        if (!this.hasTimedLyrics || !this.lyrics.length) return;
        let nextIndex = 0;
        for (let index = this.lyrics.length - 1; index >= 0; index -= 1) {
            if (currentTime >= this.lyrics[index].time) {
                nextIndex = index;
                break;
            }
        }
        if (nextIndex === this.activeLyricIndex) return;

        this.activeLyricIndex = nextIndex;
        this.updateCurrentDetailActiveLyric(nextIndex);
    },

    toggleCurrentDetailLyrics() {
        if (!this.currentSong) return;
        this.detailLyricsVisible = !this.detailLyricsVisible;
        this.renderCurrentDetail();
    },

    renderCurrentDetail() {
        const titleEl = document.getElementById('current-song-title');
        const artistEl = document.getElementById('current-song-artist');
        const albumEl = document.getElementById('current-song-album');
        const coverEl = document.getElementById('current-song-cover-large');
        const visualEl = document.getElementById('current-song-visual');
        const detailEl = document.querySelector('.current-song-detail');
        const addButton = document.getElementById('btn-current-song-add');
        const lyricButton = document.getElementById('btn-current-song-toggle-lyrics');
        if (!titleEl || !artistEl || !albumEl || !coverEl || !visualEl) return;

        const song = this.currentSong;
        const coverUrl = normalizePlayerImageUrl(song?.coverUrl || song?.album_cover || song?.album?.picUrl || song?.al?.picUrl || '');
        titleEl.textContent = this.sanitizeVisibleCopy(song?.name || '未在播放');
        artistEl.textContent = song ? this.sanitizeVisibleCopy(`歌手：${this._getArtistText(song)}`) : '';
        albumEl.textContent = song ? this.sanitizeVisibleCopy(this._getAlbumText(song)) : '';

        coverEl.dataset.fallbackApplied = '';
        if (coverUrl) {
            coverEl.classList.remove('is-broken', 'artwork-empty');
            coverEl.src = withPlayerImageSize(coverUrl, 500);
        } else {
            coverEl.removeAttribute('src');
            coverEl.classList.add('artwork-empty');
        }

        visualEl.classList.toggle('lyrics-visible', this.detailLyricsVisible);
        detailEl?.classList.toggle('lyrics-mode', this.detailLyricsVisible);
        visualEl.disabled = !song;
        document.getElementById('btn-add-current-to-playlist')?.toggleAttribute('disabled', !song);
        addButton?.toggleAttribute('disabled', !song);
        lyricButton?.classList.toggle('active', this.detailLyricsVisible);
        lyricButton?.toggleAttribute('disabled', !song);
        this.renderCurrentDetailLyrics(song ? '' : '未在播放');
        this.updateCurrentDetailPlayIcon();
        lucide.createIcons();
    },

    renderCurrentDetailLyrics(fallbackText = '') {
        const bodies = this.getCurrentDetailLyricBodies();
        const status = document.getElementById('current-song-lyrics-status');
        const currentLine = document.getElementById('current-song-lyric-current');
        if (!bodies.length) return;

        if (status) {
            status.textContent = this.hasTimedLyrics ? '同步中' : (this.lyrics.length ? '纯文本' : '暂无歌词');
        }

        if (!this.lyrics.length) {
            const text = fallbackText || '暂无歌词';
            bodies.forEach((body) => {
                body.innerHTML = `<div class="lyrics-line active">${this.escapeHtml(text)}</div>`;
            });
            if (currentLine) currentLine.textContent = text;
            return;
        }

        const activeIndex = this.hasTimedLyrics ? this.activeLyricIndex : 0;
        bodies.forEach((body) => {
            body.innerHTML = this.lyrics.map((line, index) => `
                <div class="lyrics-line ${index === activeIndex ? 'active' : ''}" data-detail-lyric-index="${index}">
                    ${this.escapeHtml(line.text || '...')}
                </div>
            `).join('');
        });
        const displayIndex = activeIndex >= 0 ? activeIndex : 0;
        if (currentLine) currentLine.textContent = this.lyrics[displayIndex]?.text || '';
    },

    updateCurrentDetailActiveLyric(nextIndex) {
        const bodies = this.getCurrentDetailLyricBodies();
        const currentLine = document.getElementById('current-song-lyric-current');
        if (!bodies.length) return;

        bodies.forEach((body) => {
            body.querySelectorAll('.lyrics-line.active').forEach((line) => line.classList.remove('active'));
            const active = body.querySelector(`[data-detail-lyric-index="${nextIndex}"]`);
            active?.classList.add('active');
            if (active) {
                body.scrollTo({
                    top: active.offsetTop - (body.clientHeight / 2) + (active.clientHeight / 2),
                    behavior: 'smooth',
                });
            }
        });
        if (currentLine) currentLine.textContent = this.lyrics[nextIndex]?.text || '';
    },

    getCurrentDetailLyricBodies() {
        return [
            document.getElementById('current-song-lyrics-body'),
            document.getElementById('current-song-lyrics-strip-body'),
        ].filter(Boolean);
    },

    updateCurrentDetailPlayIcon() {
        const iconEl = document.getElementById('icon-current-song-play');
        if (!iconEl) return;
        iconEl.setAttribute('data-lucide', this.isPlaying ? 'pause' : 'play');
        lucide.createIcons();
    },

    _getAlbumText(song) {
        const albumName = this.sanitizeVisibleCopy(song?.album?.name || song?.al?.name || song?.raw?.album?.name || song?.raw?.al?.name || '');
        return albumName ? `专辑：${albumName}` : '';
    },

    _getArtistText(song) {
        const artists = song?.artists || song?.ar || [];
        if (Array.isArray(artists)) {
            return artists
                .map((artist) => this.sanitizeVisibleCopy(typeof artist === 'string' ? artist : artist.name || ''))
                .filter(Boolean)
                .join(', ') || '未知艺术家';
        }
        if (typeof artists === 'string') return this.sanitizeVisibleCopy(artists) || '未知艺术家';
        return '未知艺术家';
    },

    renderQueue() {
        const queueList = document.getElementById('queue-list');
        const queueCount = document.getElementById('queue-count');
        if (!queueList || !queueCount) return;

        queueCount.textContent = `${this.playlist.length} 首`;
        queueList.innerHTML = this.playlist.map((song, index) => {
            const normalized = API.normalizeSong ? API.normalizeSong(song) || song : song;
            const isCurrent = index === this.currentIndex;
            return `
                <div class="song-item ${isCurrent ? 'playing' : ''}" data-queue-index="${index}">
                    ${normalized.coverUrl
                        ? `<img class="song-item-cover" src="${this.escapeAttribute(withPlayerImageSize(normalizePlayerImageUrl(normalized.coverUrl), 120))}" alt="" loading="lazy">`
                        : '<div class="song-item-cover-placeholder"><i data-lucide="music"></i></div>'
                    }
                    <div class="song-item-info">
                        <div class="song-item-name">${this.escapeHtml(normalized.name || '未知歌曲')}</div>
                        <div class="song-item-artists">${this.escapeHtml(this._getArtistText(normalized))}</div>
                    </div>
                    <div class="song-item-duration">${normalized.duration ? this.formatTime(normalized.duration / 1000) : '--:--'}</div>
                    <button class="player-btn queue-remove-btn" data-remove-index="${index}" title="移出队列"><i data-lucide="x"></i></button>
                </div>
            `;
        }).join('');

        queueList.querySelectorAll('.song-item').forEach((item) => {
            item.addEventListener('click', (event) => {
                if (event.target.closest('button')) return;
                const index = Number(item.dataset.queueIndex);
                if (Number.isFinite(index)) {
                    this.currentIndex = index;
                    this.loadSong(this.playlist[this.currentIndex]);
                    this.renderQueue();
                }
            });
        });

        queueList.querySelectorAll('.queue-remove-btn').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                this.removeFromQueue(Number(button.dataset.removeIndex));
            });
        });
        lucide.createIcons();
        this.publishDesktopState(true);
    },

    locateCurrentQueueSong() {
        const queuePanel = document.getElementById('queue-panel');
        const queueList = document.getElementById('queue-list');
        if (!queuePanel || !queueList) return;

        if (!this.playlist.length || this.currentIndex < 0) {
            if (typeof showToast === 'function') showToast('队列里还没抓到歌', 'error');
            return;
        }

        queuePanel.classList.remove('hidden');
        const currentItem = queueList.querySelector(`.song-item[data-queue-index="${this.currentIndex}"]`);
        if (!currentItem) {
            if (typeof showToast === 'function') showToast('这首歌溜出队列了', 'error');
            return;
        }

        currentItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
        currentItem.classList.remove('queue-locate-flash');
        requestAnimationFrame(() => currentItem.classList.add('queue-locate-flash'));
        setTimeout(() => currentItem.classList.remove('queue-locate-flash'), 1300);
    },

    formatTime(seconds) {
        if (!Number.isFinite(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },

    sanitizeVisibleCopy(value) {
        if (window.FrontendCopyAlias?.sanitizeVisibleCopy) {
            return window.FrontendCopyAlias.sanitizeVisibleCopy(value);
        }
        return String(value ?? '');
    },

    escapeAttribute(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },
};

function normalizePlayerImageUrl(url) {
    const text = String(url || '').trim();
    if (!text) return '';
    if (text.startsWith('//')) return `https:${text}`;
    if (text.startsWith('http://')) return text.replace(/^http:\/\//i, 'https://');
    return text;
}

function withPlayerImageSize(url, size) {
    const normalized = normalizePlayerImageUrl(url);
    if (!normalized || !size || !/^https?:\/\//i.test(normalized)) return normalized;
    const [base, hash = ''] = normalized.split('#');
    const [path, query = ''] = base.split('?');
    const params = new URLSearchParams(query);
    params.set('param', `${size}y${size}`);
    return `${path}?${params.toString()}${hash ? `#${hash}` : ''}`;
}
