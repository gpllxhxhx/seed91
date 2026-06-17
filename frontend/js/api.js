/* ===== NeteaseCloudMusicApiEnhanced client + local playlist storage ===== */
const NCM_API_BASE = String(window.NCM_API_BASE || '').replace(/\/$/, '');
const NCM_API_TOKEN = String(window.NCM_API_TOKEN || '');
const LOCAL_PLAYLIST_KEY = 'music-player:playlists:v1';
const OFFICIAL_AUDIO_LEVELS = {
    quality: ['exhigh', 'standard'],
    stable: ['exhigh', 'standard'],
};

const SEARCH_TYPES = {
    song: 1,
    album: 10,
    artist: 100,
    playlist: 1000,
    mv: 1004,
    dj: 1009,
    video: 1014,
    all: 1018,
};

function nowIso() {
    return new Date().toISOString();
}

function buildApiUrl(apiPath) {
    const normalizedPath = String(apiPath || '').replace(/^\/+/, '');
    return new URL(normalizedPath, `${NCM_API_BASE}/`);
}

function pick(obj, paths, fallback = '') {
    for (const path of paths) {
        const value = path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
}

function extractId(value, type) {
    const text = String(value || '').trim();
    if (/^\d{1,20}$/.test(text)) return text;

    const idMatch = text.match(/[?&]id=(\d{1,20})/);
    if (idMatch) return idMatch[1];

    const pathMatch = text.match(new RegExp(`/${type}/(\\d{1,20})`, 'i'));
    if (pathMatch) return pathMatch[1];

    const hashMatch = text.match(new RegExp(`#/${type}\\?id=(\\d{1,20})`, 'i'));
    return hashMatch ? hashMatch[1] : null;
}

function extractVideoId(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const idMatch = text.match(/[?&](?:id|vid)=(\w+)/);
    if (idMatch) return idMatch[1];
    return text;
}

function normalizeArtists(song) {
    const artists = song?.ar || song?.artists || song?.artist || song?.creator || [];
    if (Array.isArray(artists)) {
        return artists
            .map((artist) => (typeof artist === 'string' ? { name: artist } : { id: artist.id, name: artist.name || artist.nickname || '' }))
            .filter((artist) => artist.name);
    }
    if (typeof artists === 'string') {
        return artists.split(/[\/,]/).map((name) => ({ name: name.trim() })).filter((artist) => artist.name);
    }
    if (artists && typeof artists === 'object') {
        return [{ id: artists.id, name: artists.name || artists.nickname || '' }].filter((artist) => artist.name);
    }
    return [];
}

function normalizeSong(song) {
    if (!song) return null;
    const album = song.al || song.album || {};
    const id = Number(song.id || song.song_id);
    if (!id) return null;
    const coverUrl = album.picUrl || album.blurPicUrl || song.album_cover || song.coverUrl || song.picUrl || '';
    const artists = normalizeArtists(song);
    return {
        id,
        song_id: String(id),
        name: song.name || song.songName || '',
        artists,
        ar: artists,
        album,
        al: album,
        album_cover: coverUrl,
        coverUrl,
        duration: song.dt || song.duration || 0,
        raw: song,
    };
}

function normalizePlaylist(playlist) {
    const hasSongList = Array.isArray(playlist.songs) || Array.isArray(playlist.tracks);
    const songs = (playlist.songs || playlist.tracks || []).map(normalizeSong).filter(Boolean);
    const trackCount = hasSongList ? songs.length : (playlist.trackCount ?? playlist.song_count ?? 0);
    const id = playlist.id || Date.now();
    return {
        id,
        name: playlist.name || '未命名歌单',
        description: playlist.description || '',
        coverUrl: playlist.coverUrl || playlist.cover_url || playlist.coverImgUrl || '',
        cover_url: playlist.coverUrl || playlist.cover_url || playlist.coverImgUrl || '',
        trackCount,
        song_count: trackCount,
        playCount: playlist.playCount || playlist.play_count || 0,
        songs,
        tracks: songs,
        createdAt: playlist.createdAt || playlist.created_at || nowIso(),
        updatedAt: playlist.updatedAt || playlist.updated_at || nowIso(),
        source: playlist.source || 'local',
        neteaseId: playlist.neteaseId || playlist.netease_id || null,
        raw: playlist.raw || playlist,
    };
}

function normalizeAlbum(album) {
    if (!album) return null;
    return {
        id: album.id,
        name: album.name || '',
        artistName: pick(album, ['artist.name', 'artists.0.name']),
        coverUrl: album.picUrl || album.blurPicUrl || '',
        publishTime: album.publishTime || album.subTime || null,
        size: album.size || album.songCount || 0,
        raw: album,
    };
}

function normalizeArtist(artist) {
    if (!artist) return null;
    return {
        id: artist.id,
        name: artist.name || '',
        coverUrl: artist.picUrl || artist.img1v1Url || artist.cover || '',
        briefDesc: artist.briefDesc || '',
        musicSize: artist.musicSize || artist.musicCount || 0,
        albumSize: artist.albumSize || 0,
        mvSize: artist.mvSize || 0,
        raw: artist,
    };
}

function normalizeMedia(item, kind = 'mv') {
    if (!item) return null;
    return {
        id: item.id || item.vid,
        kind,
        name: item.name || item.title || '',
        creatorName: item.artistName || pick(item, ['creator.0.userName', 'creator.nickname', 'artists.0.name']),
        coverUrl: item.cover || item.coverUrl || item.picUrl || item.imgurl || '',
        duration: item.duration || 0,
        playCount: item.playCount || item.playTime || 0,
        raw: item,
    };
}

function readPlaylists() {
    try {
        const raw = localStorage.getItem(LOCAL_PLAYLIST_KEY);
        const playlists = raw ? JSON.parse(raw) : [];
        return Array.isArray(playlists) ? playlists.map(normalizePlaylist) : [];
    } catch (err) {
        console.warn('Local playlist read failed:', err);
        return [];
    }
}

function writePlaylists(playlists) {
    localStorage.setItem(LOCAL_PLAYLIST_KEY, JSON.stringify(playlists.map(normalizePlaylist)));
}

function upsertPlaylist(playlist) {
    const normalized = normalizePlaylist(playlist);
    const playlists = readPlaylists();
    const index = playlists.findIndex((item) => Number(item.id) === Number(normalized.id));
    if (index >= 0) playlists[index] = normalized;
    else playlists.unshift(normalized);
    writePlaylists(playlists);
    return normalized;
}

function removePlaylist(id) {
    const playlists = readPlaylists().filter((playlist) => Number(playlist.id) !== Number(id));
    writePlaylists(playlists);
}

function getLocalPlaylist(id) {
    return readPlaylists().find((playlist) => Number(playlist.id) === Number(id)) || null;
}

async function request(path, params = {}) {
    assertApiConfigured();
    const url = buildApiUrl(path);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });

    try {
        const headers = NCM_API_TOKEN ? { 'X-Music-Desktop-Token': NCM_API_TOKEN } : {};
        const res = await fetch(url.toString(), { credentials: 'include', cache: 'no-store', headers });
        const contentType = res.headers.get('content-type') || '';
        const body = contentType.includes('application/json') ? await res.json() : await res.text();
        if (!res.ok) {
            const message = body?.message || body?.msg || body?.detail || res.statusText || `HTTP ${res.status}`;
            throw new Error(message);
        }
        return body;
    } catch (err) {
        if (err.name === 'TypeError' || String(err.message).includes('Failed to fetch')) {
            throw new Error(`无法连接网易云 API 后端：${NCM_API_BASE}`);
        }
        throw err;
    }
}

function extractAudioUrl(data) {
    if (!data) return '';
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return data.find((item) => item?.url)?.url || '';
    if (typeof data.proxyUrl === 'string' && data.proxyUrl.trim()) return data.proxyUrl;
    if (typeof data.url === 'string' && data.url.trim()) return data.url;

    const payload = data.data;
    if (typeof payload === 'string') return payload;
    if (Array.isArray(payload)) return payload.find((item) => item?.url)?.url || '';
    if (payload && typeof payload === 'object') return payload.proxyUrl || payload.url || '';

    return '';
}

function getAudioPayloadItems(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (data?.data && typeof data.data === 'object') return [data.data];
    if (data && typeof data === 'object') return [data];
    return [];
}

function isTrialAudioResponse(data) {
    return getAudioPayloadItems(data).some((item) => {
        if (!item || typeof item !== 'object') return false;
        return Boolean(item.freeTrialInfo && item.freeTrialInfo !== 'null')
            || Boolean(item.freeTrialPrivilege?.resConsumable)
            || Number(item.time || 0) <= 31000 && Number(item.fee || 0) > 0;
    });
}

function getPlayableAudioItem(data) {
    return getAudioPayloadItems(data).find((item) => item?.url || item?.proxyUrl) || null;
}

function getOfficialLevels(level = 'quality') {
    return OFFICIAL_AUDIO_LEVELS[level] || OFFICIAL_AUDIO_LEVELS.quality;
}

function assertApiConfigured() {
    if (!NCM_API_BASE) throw new Error('未配置网易云 API 地址，请先设置 window.NCM_API_BASE');
}

function appendDesktopToken(url) {
    if (!NCM_API_TOKEN || !url || typeof url !== 'string') return url;
    try {
        const parsed = new URL(url, NCM_API_BASE);
        const apiOrigin = new URL(NCM_API_BASE).origin;
        if (parsed.origin !== apiOrigin) return url;
        parsed.searchParams.set('_desktop_token', NCM_API_TOKEN);
        return parsed.toString();
    } catch {
        return url;
    }
}

async function fetchPlaylistTracks(playlistId, totalHint = 0) {
    const limit = 1000;
    let offset = 0;
    const songs = [];

    while (true) {
        const data = await request('/playlist/track/all', { id: playlistId, limit, offset });
        const pageSongs = data.songs || [];
        songs.push(...pageSongs);
        offset += pageSongs.length;
        if (pageSongs.length < limit) break;
        if (totalHint && offset >= totalHint) break;
    }

    return songs;
}

function extractSearchItems(data, type) {
    const result = data.result || {};
    if (type === 'song') return result.songs || [];
    if (type === 'album') return result.albums || [];
    if (type === 'artist') return result.artists || [];
    if (type === 'playlist') return result.playlists || [];
    if (type === 'mv') return result.mvs || [];
    if (type === 'dj') return result.djRadios || [];
    if (type === 'video') return result.videos || [];
    return result.songs || result.albums || result.artists || result.playlists || [];
}

const api = {
    baseUrl: NCM_API_BASE,
    searchTypes: SEARCH_TYPES,
    normalizeSong,
    normalizePlaylist,
    normalizeAlbum,
    normalizeArtist,
    normalizeMedia,
    request,

    async health() {
        return request('/inner/version', { _t: Date.now() });
    },

    async search(keyword, type = 'song', limit = 24, offset = 0) {
        const typeValue = SEARCH_TYPES[type] || SEARCH_TYPES.song;
        const data = await request('/cloudsearch', { keywords: keyword, type: typeValue, limit, offset });
        const items = extractSearchItems(data, type);
        return { ...data, items, type };
    },

    async searchSongs(keyword, limit = 20, offset = 0) {
        const data = await this.search(keyword, 'song', limit, offset);
        const songs = (data.items || []).map(normalizeSong).filter(Boolean);
        return {
            total: data.result?.songCount || songs.length,
            songs,
            result: { ...data.result, songs },
        };
    },

    async getSearchSuggest(keyword) {
        return request('/search/suggest', { keywords: keyword, type: 'mobile' });
    },

    async getHotSearches() {
        const data = await request('/search/hot/detail');
        return data.data || [];
    },

    async importSong(urlOrId) {
        const id = extractId(urlOrId, 'song');
        if (!id) throw new Error('无法识别歌曲 ID');
        return this.getSongDetail(id);
    },

    async getSongDetail(songId) {
        const data = await request('/song/detail', { ids: songId });
        const song = normalizeSong(data.songs?.[0]);
        if (!song) throw new Error('歌曲不存在或无法获取详情');
        return song;
    },

    async checkMusic(songId) {
        return request('/check/music', { id: songId });
    },

    async getSongMusicDetail(songId) {
        return request('/song/music/detail', { id: songId });
    },

    async getOfficialPlayableAudio(songId, preferredLevel = 'quality') {
        const levels = getOfficialLevels(preferredLevel);
        const errors = [];

        for (const level of levels) {
            try {
                const data = await request('/song/url/v1', { id: songId, level });
                if (isTrialAudioResponse(data)) throw new Error(`官方 ${level} 返回的是 30 秒试听地址`);
                const item = getPlayableAudioItem(data);
                const url = appendDesktopToken(item?.proxyUrl || item?.url || extractAudioUrl(data));
                if (!url) throw new Error(`官方 ${level} 未返回播放地址`);
                return {
                    song_id: String(songId),
                    audio_url: url,
                    url,
                    level,
                    source: `官方 ${level}`,
                    sourceIndex: -1,
                    sourceCount: 0,
                    raw: data,
                };
            } catch (err) {
                errors.push(err.message || `官方 ${level} 获取失败`);
            }
        }

        throw new Error(errors.join('；') || '官方播放地址获取失败');
    },

    async getEnhancedUnblockedAudio(songId, preferredLevel = 'quality') {
        const levels = getOfficialLevels(preferredLevel);
        const errors = [];

        for (const level of levels) {
            try {
                const data = await request('/song/url/v1', { id: songId, level, unblock: 'true' });
                if (isTrialAudioResponse(data)) throw new Error(`增强解灰 ${level} 返回的是试听地址`);
                const item = getPlayableAudioItem(data);
                const url = appendDesktopToken(item?.proxyUrl || item?.url || extractAudioUrl(data));
                if (!url) throw new Error(`增强解灰 ${level} 未返回播放地址`);
                return {
                    song_id: String(songId),
                    audio_url: url,
                    url,
                    level: item?.level || level,
                    source: `增强解灰 ${level}`,
                    sourceIndex: -1,
                    sourceCount: 0,
                    raw: data,
                };
            } catch (err) {
                errors.push(err.message || `增强解灰 ${level} 获取失败`);
            }
        }

        throw new Error(errors.join('；') || '增强解灰播放地址获取失败');
    },

    async getMatchedAudio(songId, preferredLevel = 'quality') {
        try {
            const data = await request('/song/url/match', { id: songId });
            if (isTrialAudioResponse(data)) throw new Error('匹配解灰返回的是试听地址');
            const url = appendDesktopToken(extractAudioUrl(data));
            if (!url) throw new Error('匹配解灰未返回播放地址');
            return {
                song_id: String(songId),
                audio_url: url,
                url,
                level: preferredLevel,
                source: '匹配解灰',
                sourceIndex: -1,
                sourceCount: 0,
                raw: data,
            };
        } catch (err) {
            throw new Error(err.message || '匹配解灰获取失败');
        }
    },

    async getSongAudioUrl(songId, level = 'quality', options = {}) {
        const errors = [];

        try {
            return await this.getEnhancedUnblockedAudio(songId, level);
        } catch (err) {
            errors.push(err.message || '增强解灰播放地址获取失败');
        }

        try {
            return await this.getMatchedAudio(songId, level);
        } catch (err) {
            errors.push(err.message || '匹配解灰播放地址获取失败');
        }

        try {
            return await this.getOfficialPlayableAudio(songId, level);
        } catch (err) {
            errors.push(err.message || '官方播放地址获取失败');
        }

        throw new Error(errors.length ? `当前歌曲无可用播放地址：${errors.join('；')}` : '当前歌曲无可用播放地址');
    },

    async getPlayableAudio(songId, preferredLevel = 'quality', options = {}) {
        return this.getSongAudioUrl(songId, preferredLevel, options);
    },

    async getSongLyrics(songId) {
        return request('/lyric', { id: songId });
    },

    async getSongWordLyrics(songId) {
        return request('/lyric/new', { id: songId });
    },

    async getSongComments(songId, limit = 30, offset = 0) {
        const data = await request('/comment/music', { id: songId, limit, offset });
        return {
            total: data.total || 0,
            comments: data.comments || [],
            hotComments: data.hotComments || [],
            raw: data,
        };
    },

    async getPlaylists(skip = 0, limit = 50) {
        return readPlaylists().slice(skip, skip + limit);
    },

    async getPlaylistDetail(playlistId) {
        const playlist = getLocalPlaylist(playlistId);
        if (!playlist) throw new Error('歌单不存在');
        return playlist;
    },

    async getNeteasePlaylistDetail(playlistId) {
        const detailData = await request('/playlist/detail', { id: playlistId });
        const source = detailData.playlist;
        if (!source) throw new Error('歌单不存在或无法获取详情');
        const trackItems = await fetchPlaylistTracks(playlistId, source.trackCount || 0);
        const songs = (trackItems.length ? trackItems : source.tracks || []).map(normalizeSong).filter(Boolean);
        return normalizePlaylist({
            id: Number(playlistId),
            name: source.name,
            description: source.description || '',
            coverUrl: source.coverImgUrl || '',
            songs,
            playCount: source.playCount || 0,
            source: 'netease-remote',
            neteaseId: String(playlistId),
            createdAt: new Date(source.createTime || Date.now()).toISOString(),
            updatedAt: nowIso(),
            raw: source,
        });
    },

    async importPlaylist(urlOrId) {
        const playlistId = extractId(urlOrId, 'playlist');
        if (!playlistId) throw new Error('无法识别歌单 ID');
        const playlist = await this.getNeteasePlaylistDetail(playlistId);
        return upsertPlaylist({
            ...playlist,
            id: Number(`9${String(playlistId).slice(-12)}`),
            source: 'netease',
        });
    },

    async createPlaylist(nameOrData, description = '') {
        const data = typeof nameOrData === 'object' ? nameOrData : { name: nameOrData, description };
        const name = String(data.name || '').trim();
        if (!name) throw new Error('请输入歌单名称');
        return upsertPlaylist({
            id: Date.now(),
            name,
            description: data.description || '',
            coverUrl: '',
            songs: [],
            source: 'local',
            neteaseId: null,
        });
    },

    async updatePlaylist(playlistId, data) {
        const playlist = getLocalPlaylist(playlistId);
        if (!playlist) throw new Error('歌单不存在');
        return upsertPlaylist({
            ...playlist,
            name: data.name ?? playlist.name,
            description: data.description ?? playlist.description,
            coverUrl: data.coverUrl ?? data.cover_url ?? playlist.coverUrl,
            updatedAt: nowIso(),
        });
    },

    async deletePlaylist(id) {
        removePlaylist(id);
        return null;
    },

    async addSongToPlaylist(playlistId, songOrId) {
        const playlist = getLocalPlaylist(playlistId);
        if (!playlist) throw new Error('歌单不存在');

        const song = typeof songOrId === 'object' ? normalizeSong(songOrId) : await this.getSongDetail(songOrId);
        if (!song) throw new Error('歌曲不存在');

        const songId = Number(song.id);
        const songs = playlist.songs.filter((item) => Number(item.id) !== songId);
        songs.push(song);
        return upsertPlaylist({
            ...playlist,
            songs,
            trackCount: songs.length,
            song_count: songs.length,
            coverUrl: playlist.coverUrl || song.coverUrl || '',
            updatedAt: nowIso(),
        });
    },

    async refreshPlaylist(playlistId) {
        const playlist = getLocalPlaylist(playlistId);
        if (!playlist) throw new Error('歌单不存在');
        if (!playlist.neteaseId) return playlist;
        const songs = (await fetchPlaylistTracks(playlist.neteaseId)).map(normalizeSong).filter(Boolean);
        return upsertPlaylist({ ...playlist, songs, updatedAt: nowIso() });
    },

    async removeSongsFromPlaylist(playlistId, songIds) {
        const playlist = getLocalPlaylist(playlistId);
        if (!playlist) throw new Error('歌单不存在');
        const removeSet = new Set(songIds.map(Number));
        const songs = playlist.songs.filter((song) => !removeSet.has(Number(song.id)));
        return upsertPlaylist({
            ...playlist,
            songs,
            trackCount: songs.length,
            song_count: songs.length,
            updatedAt: nowIso(),
        });
    },

    async getAudioUrl(songId, level = 'unblock') {
        return this.getSongAudioUrl(songId, level);
    },

    async getAudioQualities(songId) {
        const audio = await this.getSongAudioUrl(songId);
        return {
            song_id: String(songId),
            qualities: [{ level: 'unblock', label: '解灰源决定', available: Boolean(audio.audio_url) }],
            recommended: 'unblock',
        };
    },

    getStreamUrl(songId) {
        assertApiConfigured();
        const url = buildApiUrl('/song/url/v1');
        url.searchParams.set('id', songId);
        url.searchParams.set('level', 'exhigh');
        url.searchParams.set('unblock', 'true');
        if (NCM_API_TOKEN) url.searchParams.set('_desktop_token', NCM_API_TOKEN);
        return url.toString();
    },

    async getBanners() {
        const data = await request('/banner', { type: 0 });
        return data.banners || [];
    },

    async getPersonalizedPlaylists(limit = 12) {
        const data = await request('/personalized', { limit });
        return data.result || [];
    },

    async getPersonalizedNewSongs(limit = 12) {
        const data = await request('/personalized/newsong', { limit });
        return (data.result || []).map((item) => normalizeSong(item.song || item)).filter(Boolean);
    },

    async getPersonalizedMvs() {
        const data = await request('/personalized/mv');
        return (data.result || []).map((item) => normalizeMedia(item, 'mv')).filter(Boolean);
    },

    async getToplists() {
        const data = await request('/toplist/detail');
        return data.list || [];
    },

    async getTopSongs(type = 0) {
        const data = await request('/top/song', { type });
        return (data.data || []).map(normalizeSong).filter(Boolean);
    },

    async getTopArtists(limit = 12, offset = 0) {
        const data = await request('/top/artists', { limit, offset });
        return (data.artists || []).map(normalizeArtist).filter(Boolean);
    },

    async getNewestAlbums() {
        const data = await request('/album/newest');
        return (data.albums || []).map(normalizeAlbum).filter(Boolean);
    },

    async getAlbumDetail(albumId) {
        const data = await request('/album', { id: albumId });
        return {
            album: normalizeAlbum(data.album),
            songs: (data.songs || []).map(normalizeSong).filter(Boolean),
            raw: data,
        };
    },

    async getArtistDetail(artistId) {
        const detail = await request('/artist/detail', { id: artistId });
        const songs = await request('/artist/songs', { id: artistId, limit: 50, order: 'hot' }).catch(() => ({ songs: [] }));
        const albums = await request('/artist/album', { id: artistId, limit: 12 }).catch(() => ({ hotAlbums: [] }));
        const mvs = await request('/artist/mv', { id: artistId, limit: 12 }).catch(() => ({ mvs: [] }));
        return {
            artist: normalizeArtist(detail.data?.artist || detail.artist || detail.data),
            songs: (songs.songs || songs.hotSongs || []).map(normalizeSong).filter(Boolean),
            albums: (albums.hotAlbums || albums.albums || []).map(normalizeAlbum).filter(Boolean),
            mvs: (mvs.mvs || []).map((item) => normalizeMedia(item, 'mv')).filter(Boolean),
            raw: detail,
        };
    },

    async getMvDetail(mvId) {
        const detail = await request('/mv/detail', { mvid: mvId });
        const urlData = await request('/mv/url', { id: mvId }).catch(() => ({}));
        return {
            media: normalizeMedia(detail.data, 'mv'),
            url: urlData.data?.url || '',
            raw: detail,
        };
    },

    async getVideoDetail(videoId) {
        const id = extractVideoId(videoId);
        const detail = await request('/video/detail', { id });
        const urlData = await request('/video/url', { id }).catch(() => ({}));
        return {
            media: normalizeMedia(detail.data, 'video'),
            url: urlData.urls?.[0]?.url || '',
            raw: detail,
        };
    },

    async getDjBanners() {
        const data = await request('/dj/banner');
        return data.data || [];
    },

    async getHotDjs(limit = 12) {
        const data = await request('/dj/hot', { limit });
        return data.djRadios || [];
    },

    async getDjPrograms(rid, limit = 30) {
        return request('/dj/program', { rid, limit });
    },
};

const API = api;
