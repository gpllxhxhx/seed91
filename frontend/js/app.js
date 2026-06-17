/* ===== Music Player Application ===== */
let currentPlaylistId = null;
let currentPage = 'home';
let previousPage = 'home';
let pendingSong = null;
let confirmDialogResolver = null;
let discoverRefreshTick = 0;

const MORE_SECTION_META = {
    playlists: { label: '推荐歌单', title: '推荐歌单', subtitle: '更多适合现在播放的歌单。' },
    songs: { label: '新歌推荐', title: '新歌推荐', subtitle: '更多新鲜发布的歌曲。' },
    toplists: { label: '榜单', title: '榜单', subtitle: '全部热门榜单与更新频率。' },
    artists: { label: '热门歌手', title: '热门歌手', subtitle: '更多正在被聆听的歌手。' },
    albums: { label: '最新专辑', title: '最新专辑', subtitle: '近期上线的专辑。' },
    mvs: { label: '推荐 MV', title: '推荐 MV', subtitle: '更多推荐视频内容。' },
    djs: { label: '热门电台', title: '热门电台', subtitle: '更多电台和节目。' },
};

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showConfirmDialog(message, options = {}) {
    const modal = document.getElementById('modal-confirm');
    const messageEl = document.getElementById('confirm-message');
    const titleEl = document.getElementById('confirm-title');
    const confirmBtn = document.getElementById('btn-confirm-action');
    const cancelBtn = document.getElementById('btn-cancel-confirm');
    if (!modal || !messageEl || !confirmBtn || !cancelBtn) return Promise.resolve(false);

    titleEl.textContent = options.title || '确认操作';
    messageEl.textContent = message;
    confirmBtn.textContent = options.confirmText || '确认';
    cancelBtn.textContent = options.cancelText || '取消';
    confirmBtn.className = options.danger ? 'btn btn-danger-outline' : 'btn btn-primary';
    modal.classList.remove('hidden');
    confirmBtn.focus();

    return new Promise((resolve) => {
        confirmDialogResolver = resolve;
    });
}

function closeConfirmDialog(result = false) {
    document.getElementById('modal-confirm')?.classList.add('hidden');
    const resolver = confirmDialogResolver;
    confirmDialogResolver = null;
    if (resolver) resolver(Boolean(result));
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function escapeAttribute(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatCount(value) {
    const number = Number(value || 0);
    if (number >= 100000000) return `${(number / 100000000).toFixed(1)} 亿`;
    if (number >= 10000) return `${(number / 10000).toFixed(1)} 万`;
    return String(number);
}

function formatDate(ms) {
    if (!ms) return '';
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('zh-CN');
}

function getArtistText(song) {
    const artists = song?.artists || song?.ar || [];
    if (Array.isArray(artists)) {
        return artists.map((artist) => (typeof artist === 'string' ? artist : artist.name || '')).filter(Boolean).join(', ') || '未知艺术家';
    }
    return typeof artists === 'string' ? artists : '未知艺术家';
}

function normalizeImageUrl(url) {
    const text = String(url || '').trim();
    if (!text) return '';
    if (text.startsWith('//')) return `https:${text}`;
    if (text.startsWith('http://')) return text.replace(/^http:\/\//i, 'https://');
    return text;
}

function withImageSize(url, size) {
    const normalized = normalizeImageUrl(url);
    if (!normalized || !size || !/^https?:\/\//i.test(normalized)) return normalized;
    const [base, hash = ''] = normalized.split('#');
    const [path, query = ''] = base.split('?');
    const params = new URLSearchParams(query);
    params.set('param', `${size}y${size}`);
    return `${path}?${params.toString()}${hash ? `#${hash}` : ''}`;
}

function imageAttr(url, size = null) {
    return escapeAttribute(size ? withImageSize(url, size) : normalizeImageUrl(url));
}

function setImageSrc(img, url, size = null) {
    if (!img) return;
    const normalized = size ? withImageSize(url, size) : normalizeImageUrl(url);
    img.dataset.fallbackApplied = '';
    if (normalized) {
        img.classList.remove('is-broken', 'artwork-empty');
        img.src = normalized;
    } else {
        img.removeAttribute('src');
        img.classList.add('artwork-empty');
    }
}

function normalizePlaylistsResponse(result) {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.playlists)) return result.playlists;
    if (result && result.playlist) return [result.playlist];
    return [];
}

function getPlaylistSongCount(playlist) {
    if (!playlist) return 0;
    if (Array.isArray(playlist.songs)) return playlist.songs.length;
    if (Array.isArray(playlist.tracks)) return playlist.tracks.length;
    return Number(playlist.trackCount ?? playlist.song_count ?? 0) || 0;
}

function pickDisplayItems(items, count, shouldShuffle = false) {
    const list = Array.isArray(items) ? [...items] : [];
    if (!shouldShuffle) return list.slice(0, count);
    return list.sort(() => Math.random() - 0.5).slice(0, count);
}

function setApiStatus(text, ok = false) {
    const el = document.getElementById('api-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('connected', ok);
}

function navigateTo(pageName, options = {}) {
    const target = document.getElementById(`page-${pageName}`);
    if (!target) return;

    if (!options.keepPrevious && pageName !== currentPage) previousPage = currentPage;
    currentPage = pageName;

    document.querySelectorAll('.page').forEach((page) => {
        page.classList.toggle('active', page.id === `page-${pageName}`);
    });
    const mainContent = document.querySelector('.main-content');
    mainContent?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    requestAnimationFrame(() => {
        mainContent?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    setTimeout(() => {
        mainContent?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, 120);
    document.body.classList.remove('current-song-fullscreen');
    const playerEntry = document.getElementById('player-current-entry');
    if (playerEntry) playerEntry.title = pageName === 'current-song-detail' ? '返回' : '歌曲详情';
    document.querySelectorAll('.nav-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });
    document.getElementById('queue-panel')?.classList.add('hidden');
    document.getElementById('comments-panel')?.classList.add('hidden');

    if (pageName === 'home') loadDiscover();
    if (pageName === 'playlists') loadPlaylists();
    if (pageName === 'desktop') loadDesktopVersion();
}

function renderCover(url, className, fallbackIcon = 'music', size = 180) {
    const normalized = withImageSize(url, size);
    if (normalized) return `<img class="${className}" src="${imageAttr(normalized)}" alt="" loading="lazy">`;
    return `<div class="${className} placeholder"><i data-lucide="${fallbackIcon}"></i></div>`;
}

function createSongListHTML(songs) {
    return (songs || []).map((rawSong) => {
        const song = API.normalizeSong(rawSong) || rawSong;
        const duration = song.duration ? Player.formatTime(song.duration / 1000) : '--:--';
        const isPlaying = Player.currentSong && Number(Player.currentSong.id) === Number(song.id);
        return `
            <div class="song-item ${isPlaying ? 'playing' : ''}" data-song-id="${song.id}">
                ${renderCover(song.coverUrl, 'song-item-cover', 'music', 120)}
                <div class="song-item-info">
                    <div class="song-item-name">${escapeHtml(song.name || '未知歌曲')}</div>
                    <div class="song-item-artists">${escapeHtml(getArtistText(song))}</div>
                </div>
                <div class="song-item-duration">${duration}</div>
                <div class="song-item-actions">
                    <button class="btn btn-outline btn-lyrics" data-song-id="${song.id}" title="歌词"><i data-lucide="file-text"></i></button>
                    <button class="btn btn-outline btn-add-to-playlist" data-song-id="${song.id}" title="添加到歌单"><i data-lucide="plus-circle"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

function bindSongListEvents(container, songs) {
    if (!container) return;
    const normalizedSongs = (songs || []).map((song) => API.normalizeSong(song) || song).filter(Boolean);

    container.querySelectorAll('.song-item').forEach((item) => {
        item.addEventListener('click', (event) => {
            if (event.target.closest('button')) return;
            const songId = Number(item.dataset.songId);
            Player.playSongList(normalizedSongs, songId);
            if (typeof openCurrentSongDetail === 'function') openCurrentSongDetail();
        });
    });

    container.querySelectorAll('.btn-add-to-playlist').forEach((btn) => {
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const songId = Number(btn.dataset.songId);
            const song = normalizedSongs.find((item) => Number(item.id) === songId) || { id: songId };
            showPlaylistPicker(song, '添加');
        });
    });

    container.querySelectorAll('.btn-lyrics').forEach((btn) => {
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            await openLyrics(btn.dataset.songId);
        });
    });

    lucide.createIcons();
}

function createCard(item, type) {
    const cover = item.coverUrl || item.picUrl || item.coverImgUrl || item.cover || item.img1v1Url || '';
    const title = item.name || item.title || '未命名';
    const subtitle = item.artistName || item.creatorName || item.copywriter || item.description || '';
    const isPlaylistCard = type === 'local-playlist' || type === 'netease-playlist';
    const count = isPlaylistCard
        ? getPlaylistSongCount(item)
        : (item.trackCount ?? item.playCount ?? item.programCount ?? item.size ?? 0);
    const shouldShowCount = count > 0 || isPlaylistCard;
    const countText = isPlaylistCard ? `${formatCount(count)} 首` : formatCount(count);
    return `
        <div class="content-card" data-type="${escapeAttribute(type)}" data-id="${escapeAttribute(item.id || item.vid || item.alg || '')}">
            ${renderCover(cover, 'content-card-cover', type === 'artist' ? 'user-round' : 'disc-3', 240)}
            <div class="content-card-name">${escapeHtml(title)}</div>
            <div class="content-card-subtitle">${escapeHtml(subtitle)}</div>
            ${shouldShowCount ? `<div class="content-card-count">${countText}</div>` : ''}
        </div>
    `;
}

function createCompactItem(item, type) {
    const cover = item.coverUrl || item.picUrl || item.coverImgUrl || item.cover || item.img1v1Url || '';
    const title = item.name || item.title || '未命名';
    const subtitle = item.artistName || item.creatorName || item.updateFrequency || item.briefDesc || '';
    return `
        <div class="compact-item" data-type="${escapeAttribute(type)}" data-id="${escapeAttribute(item.id || item.vid || '')}">
            ${renderCover(cover, 'compact-cover', type === 'artist' ? 'user-round' : 'music', 120)}
            <div class="compact-info">
                <div class="compact-title">${escapeHtml(title)}</div>
                <div class="compact-subtitle">${escapeHtml(subtitle)}</div>
            </div>
            <i data-lucide="chevron-right"></i>
        </div>
    `;
}

function bindEntityCards(scope = document) {
    scope.querySelectorAll('[data-type][data-id]').forEach((el) => {
        el.addEventListener('click', () => {
            const type = el.dataset.type;
            const id = el.dataset.id;
            if (!id) return;
            openEntity(type, id);
        });
    });
    lucide.createIcons();
}

async function checkBackend() {
    try {
        const version = await API.health();
        setApiStatus(`API ${version.version || version.data?.version || '已连接'}`, true);
    } catch (err) {
        setApiStatus('API 未连接', false);
        showToast(err.message, 'error');
    }
}

async function loadDiscover(forceRefresh = false) {
    if (forceRefresh) discoverRefreshTick += 1;
    const refreshBtn = document.getElementById('btn-refresh-discover');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('is-refreshing');
    }

    const refreshToken = forceRefresh ? discoverRefreshTick : 0;

    await Promise.allSettled([
        loadBanners(forceRefresh),
        loadHotSearches(),
        loadDiscoverPlaylists(refreshToken),
        loadDiscoverSongs(refreshToken),
        loadToplists(refreshToken),
        loadTopArtists(refreshToken),
        loadNewestAlbums(refreshToken),
        loadPersonalizedMvs(refreshToken),
        loadHotDjs(refreshToken),
    ]);

    if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('is-refreshing');
    }
    lucide.createIcons();
}

async function loadBanners(forceRefresh = false) {
    const el = document.getElementById('banner-strip');
    if (!el) return;
    try {
        const banners = pickDisplayItems(await API.getBanners(), 5, forceRefresh);
        el.innerHTML = banners.map((banner) => `
            <div class="banner-card">
                ${renderCover(banner.bigImageUrl || banner.imageUrl || banner.pic, 'banner-image', 'image', 360)}
                <div class="banner-mask">
                    <div>${escapeHtml(banner.typeTitle || '推荐')}</div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    } catch {
        el.innerHTML = '';
    }
}

async function loadHotSearches() {
    const el = document.getElementById('hot-search-list');
    if (!el) return;
    try {
        const items = (await API.getHotSearches()).slice(0, 12);
        el.innerHTML = items.map((item) => `<button class="chip" data-keyword="${escapeAttribute(item.searchWord)}">${escapeHtml(item.searchWord)}</button>`).join('');
        el.querySelectorAll('.chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                document.getElementById('search-input').value = chip.dataset.keyword;
                document.getElementById('search-type').value = 'song';
                navigateTo('search');
                performSearch();
            });
        });
    } catch {
        el.innerHTML = '';
    }
}

async function loadDiscoverPlaylists(refreshToken = 0) {
    const el = document.getElementById('discover-playlists');
    if (!el) return;
    const items = pickDisplayItems(await API.getPersonalizedPlaylists(refreshToken ? 36 : 12), 12, Boolean(refreshToken));
    el.innerHTML = items.map((item) => createCard({
        id: item.id,
        name: item.name,
        coverUrl: item.picUrl,
        playCount: item.playCount,
        description: item.copywriter,
    }, 'netease-playlist')).join('');
    bindEntityCards(el);
}

async function loadDiscoverSongs(refreshToken = 0) {
    const el = document.getElementById('discover-songs');
    if (!el) return;
    const songs = pickDisplayItems(await API.getPersonalizedNewSongs(refreshToken ? 30 : 12), 12, Boolean(refreshToken));
    el.innerHTML = createSongListHTML(songs);
    bindSongListEvents(el, songs);
}

async function loadToplists(refreshToken = 0) {
    const el = document.getElementById('discover-toplists');
    if (!el) return;
    const items = pickDisplayItems(await API.getToplists(), 8, Boolean(refreshToken));
    el.innerHTML = items.map((item) => createCompactItem({
        id: item.id,
        name: item.name,
        coverUrl: item.coverImgUrl,
        updateFrequency: item.updateFrequency,
    }, 'netease-playlist')).join('');
    bindEntityCards(el);
}

async function loadTopArtists(refreshToken = 0) {
    const el = document.getElementById('discover-artists');
    if (!el) return;
    const artists = await API.getTopArtists(refreshToken ? 24 : 8, refreshToken ? (refreshToken * 8) % 72 : 0);
    el.innerHTML = artists.map((artist) => createCompactItem(artist, 'artist')).join('');
    bindEntityCards(el);
}

async function loadNewestAlbums(refreshToken = 0) {
    const el = document.getElementById('discover-albums');
    if (!el) return;
    const albums = pickDisplayItems(await API.getNewestAlbums(), 8, Boolean(refreshToken));
    el.innerHTML = albums.map((album) => createCompactItem({
        ...album,
        artistName: `${album.artistName}${album.publishTime ? ` · ${formatDate(album.publishTime)}` : ''}`,
    }, 'album')).join('');
    bindEntityCards(el);
}

async function loadPersonalizedMvs(refreshToken = 0) {
    const el = document.getElementById('discover-mvs');
    if (!el) return;
    const mvs = pickDisplayItems(await API.getPersonalizedMvs(), 8, Boolean(refreshToken));
    el.innerHTML = mvs.map((mv) => createCompactItem(mv, 'mv')).join('');
    bindEntityCards(el);
}

async function loadHotDjs(refreshToken = 0) {
    const el = document.getElementById('discover-djs');
    if (!el) return;
    const djs = pickDisplayItems(await API.getHotDjs(refreshToken ? 24 : 8), 8, Boolean(refreshToken));
    el.innerHTML = djs.map((item) => createCard({
        id: item.id,
        name: item.name,
        coverUrl: item.picUrl,
        creatorName: item.dj?.nickname || '',
        programCount: item.programCount,
    }, 'dj')).join('');
    bindEntityCards(el);
}

async function openMoreSection(sectionName) {
    const meta = MORE_SECTION_META[sectionName];
    if (!meta) return;

    setEntityHeader({
        label: meta.label,
        title: meta.title,
        subtitle: meta.subtitle,
        description: '',
        coverUrl: '',
        heroClass: 'collection-hero',
    });

    const content = document.getElementById('entity-content');
    content.innerHTML = '<div class="loading-row">加载中...</div>';
    navigateTo('entity-detail');

    try {
        if (sectionName === 'playlists') {
            const items = await API.getPersonalizedPlaylists(36);
            content.innerHTML = `<div class="card-grid more-grid">${items.map((item) => createCard({
                id: item.id,
                name: item.name,
                coverUrl: item.picUrl,
                playCount: item.playCount,
                description: item.copywriter,
            }, 'netease-playlist')).join('')}</div>`;
            bindEntityCards(content);
            return;
        }

        if (sectionName === 'songs') {
            const songs = await API.getPersonalizedNewSongs(50);
            content.innerHTML = `<div class="song-list more-song-list">${createSongListHTML(songs)}</div>`;
            bindSongListEvents(content, songs);
            return;
        }

        if (sectionName === 'toplists') {
            const items = await API.getToplists();
            content.innerHTML = `<div class="card-grid more-grid">${items.map((item) => createCard({
                id: item.id,
                name: item.name,
                coverUrl: item.coverImgUrl,
                description: item.updateFrequency,
                playCount: item.playCount,
            }, 'netease-playlist')).join('')}</div>`;
            bindEntityCards(content);
            return;
        }

        if (sectionName === 'artists') {
            const artists = await API.getTopArtists(40, 0);
            content.innerHTML = `<div class="card-grid more-grid">${artists.map((artist) => createCard(artist, 'artist')).join('')}</div>`;
            bindEntityCards(content);
            return;
        }

        if (sectionName === 'albums') {
            const albums = await API.getNewestAlbums();
            content.innerHTML = `<div class="card-grid more-grid">${albums.map((album) => createCard({
                ...album,
                artistName: `${album.artistName}${album.publishTime ? ` · ${formatDate(album.publishTime)}` : ''}`,
            }, 'album')).join('')}</div>`;
            bindEntityCards(content);
            return;
        }

        if (sectionName === 'mvs') {
            const mvs = await API.getPersonalizedMvs();
            content.innerHTML = `<div class="card-grid more-grid">${mvs.map((mv) => createCard(mv, 'mv')).join('')}</div>`;
            bindEntityCards(content);
            return;
        }

        if (sectionName === 'djs') {
            const djs = await API.getHotDjs(40);
            content.innerHTML = `<div class="card-grid more-grid">${djs.map((item) => createCard({
                id: item.id,
                name: item.name,
                coverUrl: item.picUrl,
                creatorName: item.dj?.nickname || '',
                programCount: item.programCount,
            }, 'dj')).join('')}</div>`;
            bindEntityCards(content);
        }
    } catch (err) {
        console.error('Open more section error:', err);
        content.innerHTML = '<div class="empty-state"><p>内容加载失败</p></div>';
        showToast(err.message || '加载更多内容失败', 'error');
    }
}

async function performSearch() {
    const input = document.getElementById('search-input');
    const typeSelect = document.getElementById('search-type');
    const query = input.value.trim();
    const type = typeSelect.value;
    if (!query) return;

    document.querySelectorAll('#search-tabs .tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.searchType === type);
    });

    const container = document.getElementById('search-results-container');
    const emptyHint = document.getElementById('search-empty');
    const noResult = document.getElementById('search-no-result');
    container.innerHTML = '<div class="loading-row">搜索中...</div>';
    emptyHint.classList.add('hidden');
    noResult.classList.add('hidden');

    try {
        const result = await API.search(query, type, 30);
        const items = result.items || [];
        if (!items.length) {
            container.innerHTML = '';
            noResult.classList.remove('hidden');
            return;
        }
        renderSearchResults(container, type, items);
    } catch (err) {
        console.error('Search error:', err);
        container.innerHTML = '';
        showToast(err.message || '搜索失败', 'error');
    }
}

function renderSearchResults(container, type, items) {
    if (type === 'song') {
        const songs = items.map(API.normalizeSong).filter(Boolean);
        container.innerHTML = `<div class="song-list">${createSongListHTML(songs)}</div>`;
        bindSongListEvents(container, songs);
        return;
    }

    if (type === 'album') {
        const albums = items.map(API.normalizeAlbum).filter(Boolean);
        container.innerHTML = `<div class="card-grid">${albums.map((item) => createCard(item, 'album')).join('')}</div>`;
    } else if (type === 'artist') {
        const artists = items.map(API.normalizeArtist).filter(Boolean);
        container.innerHTML = `<div class="card-grid">${artists.map((item) => createCard(item, 'artist')).join('')}</div>`;
    } else if (type === 'playlist') {
        container.innerHTML = `<div class="card-grid">${items.map((item) => createCard({
            id: item.id,
            name: item.name,
            coverUrl: item.coverImgUrl,
            creatorName: item.creator?.nickname,
            trackCount: item.trackCount,
        }, 'netease-playlist')).join('')}</div>`;
    } else if (type === 'mv' || type === 'video') {
        const mediaType = type;
        const media = items.map((item) => API.normalizeMedia(item, mediaType)).filter(Boolean);
        container.innerHTML = `<div class="card-grid">${media.map((item) => createCard(item, mediaType)).join('')}</div>`;
    } else if (type === 'dj') {
        container.innerHTML = `<div class="card-grid">${items.map((item) => createCard({
            id: item.id,
            name: item.name,
            coverUrl: item.picUrl,
            creatorName: item.dj?.nickname,
            programCount: item.programCount,
        }, 'dj')).join('')}</div>`;
    }
    bindEntityCards(container);
}

async function loadPlaylists() {
    try {
        const playlists = normalizePlaylistsResponse(await API.getPlaylists());
        const container = document.getElementById('playlist-grid');
        const emptyState = document.getElementById('playlist-empty');
        if (!container || !emptyState) return;

        if (playlists.length) {
            emptyState.classList.add('hidden');
            container.classList.remove('hidden');
            container.innerHTML = playlists.map((playlist) => createCard({
                id: playlist.id,
                name: playlist.name,
                coverUrl: playlist.coverUrl,
                trackCount: playlist.trackCount,
                creatorName: playlist.source === 'netease' ? '链接导入' : '本地',
            }, 'local-playlist')).join('');
            bindEntityCards(container);
        } else {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Load playlists error:', err);
        showToast(err.message || '加载歌单失败', 'error');
    }
}

async function openPlaylistDetail(playlistId) {
    try {
        currentPlaylistId = playlistId;
        const playlist = await API.getPlaylistDetail(playlistId);
        renderPlaylistDetail(playlist, true);
        navigateTo('playlist-detail');
    } catch (err) {
        console.error('Open playlist detail error:', err);
        showToast(err.message || '加载歌单详情失败', 'error');
    }
}

function renderPlaylistDetail(playlist, editable) {
    const songs = playlist.tracks || playlist.songs || [];
    document.getElementById('detail-source').textContent = playlist.source === 'netease' ? '导入歌单' : '本地歌单';
    document.getElementById('detail-name').textContent = playlist.name || '未命名歌单';
    document.getElementById('detail-desc').textContent = playlist.description || '';
    document.getElementById('detail-meta-text').textContent = `${songs.length} 首歌曲 · ${formatCount(playlist.playCount || 0)} 次播放`;
    setImageSrc(document.getElementById('detail-cover'), playlist.coverUrl || playlist.cover_url || '');

    const songContainer = document.getElementById('detail-song-list');
    const emptyState = document.getElementById('detail-empty');
    if (songs.length) {
        emptyState.classList.add('hidden');
        songContainer.innerHTML = createSongListHTML(songs);
        bindSongListEvents(songContainer, songs);
    } else {
        emptyState.classList.remove('hidden');
        songContainer.innerHTML = '';
    }

    document.getElementById('btn-play-all').onclick = () => Player.playPlaylist(songs, 0);
    document.getElementById('btn-refresh-playlist').style.display = playlist.neteaseId ? '' : 'none';
    document.getElementById('btn-refresh-playlist').onclick = async () => {
        try {
            showToast('正在刷新歌单...');
            const refreshed = await API.refreshPlaylist(playlist.id);
            renderPlaylistDetail(refreshed, editable);
            showToast('歌单已刷新');
        } catch (err) {
            showToast(err.message || '刷新失败', 'error');
        }
    };
    document.getElementById('btn-delete-playlist').style.display = editable ? '' : 'none';
    document.getElementById('btn-delete-playlist').onclick = async () => {
        const confirmed = await showConfirmDialog('确定删除这个本地歌单吗？', {
            title: '删除歌单',
            confirmText: '删除',
            danger: true,
        });
        if (!confirmed) return;
        await API.deletePlaylist(playlist.id);
        showToast('歌单已删除');
        navigateTo('playlists');
    };
}

async function openEntity(type, id) {
    try {
        if (type === 'local-playlist') return openPlaylistDetail(Number(id));
        if (type === 'netease-playlist') return openNeteasePlaylist(id);
        if (type === 'album') return openAlbum(id);
        if (type === 'artist') return openArtist(id);
        if (type === 'mv') return openMv(id);
        if (type === 'video') return openVideo(id);
        if (type === 'dj') return openDj(id);
    } catch (err) {
        console.error('Open entity error:', err);
        showToast(err.message || '加载详情失败', 'error');
    }
}

function setEntityHeader({ label, title, subtitle, description, coverUrl, actions = '', heroClass = '' }) {
    const hero = document.querySelector('#page-entity-detail .detail-hero');
    if (hero) {
        hero.className = 'detail-hero';
        if (heroClass) hero.classList.add(heroClass);
    }
    document.getElementById('entity-label').textContent = label || '';
    document.getElementById('entity-title').textContent = title || '';
    document.getElementById('entity-subtitle').textContent = subtitle || '';
    document.getElementById('entity-description').textContent = description || '';
    setImageSrc(document.getElementById('entity-cover'), coverUrl || '');
    document.getElementById('entity-actions').innerHTML = actions;
    document.getElementById('entity-media-player').classList.add('hidden');
    document.getElementById('entity-media-player').innerHTML = '';
    lucide.createIcons();
}

async function openNeteasePlaylist(id) {
    const playlist = await API.getNeteasePlaylistDetail(id);
    setEntityHeader({
        label: '导入歌单',
        title: playlist.name,
        subtitle: `${playlist.tracks.length} 首歌曲 · ${formatCount(playlist.playCount)} 次播放`,
        description: playlist.description,
        coverUrl: playlist.coverUrl,
        actions: `
            <button class="btn btn-primary" id="entity-play-all"><i data-lucide="play"></i> 播放全部</button>
            <button class="btn btn-outline" id="entity-import-playlist"><i data-lucide="download"></i> 保存到本地</button>
        `,
    });
    document.getElementById('entity-content').innerHTML = `<div class="song-list">${createSongListHTML(playlist.tracks)}</div>`;
    bindSongListEvents(document.getElementById('entity-content'), playlist.tracks);
    document.getElementById('entity-play-all').onclick = () => Player.playPlaylist(playlist.tracks, 0);
    document.getElementById('entity-import-playlist').onclick = async () => {
        await API.importPlaylist(id);
        showToast('歌单已保存到本地');
        await loadPlaylists();
    };
    navigateTo('entity-detail');
}

async function openAlbum(id) {
    const { album, songs } = await API.getAlbumDetail(id);
    setEntityHeader({
        label: '专辑',
        title: album?.name || '未知专辑',
        subtitle: `${album?.artistName || ''}${album?.publishTime ? ` · ${formatDate(album.publishTime)}` : ''}`,
        description: `${songs.length} 首歌曲`,
        coverUrl: album?.coverUrl,
        actions: `<button class="btn btn-primary" id="entity-play-all"><i data-lucide="play"></i> 播放全部</button>`,
    });
    document.getElementById('entity-content').innerHTML = `<div class="song-list">${createSongListHTML(songs)}</div>`;
    bindSongListEvents(document.getElementById('entity-content'), songs);
    document.getElementById('entity-play-all').onclick = () => Player.playPlaylist(songs, 0);
    navigateTo('entity-detail');
}

async function openArtist(id) {
    const { artist, songs, albums, mvs } = await API.getArtistDetail(id);
    setEntityHeader({
        label: '歌手',
        title: artist?.name || '未知歌手',
        subtitle: `${artist?.musicSize || songs.length} 首歌 · ${artist?.albumSize || albums.length} 张专辑 · ${artist?.mvSize || mvs.length} 个 MV`,
        description: artist?.briefDesc || '',
        coverUrl: artist?.coverUrl,
        actions: `<button class="btn btn-primary" id="entity-play-all"><i data-lucide="play"></i> 播放热门歌曲</button>`,
    });
    document.getElementById('entity-content').innerHTML = `
        <section class="section-block"><div class="section-title"><h3>热门歌曲</h3></div><div class="song-list">${createSongListHTML(songs)}</div></section>
        <section class="section-block"><div class="section-title"><h3>专辑</h3></div><div class="card-grid">${albums.map((album) => createCard(album, 'album')).join('')}</div></section>
        <section class="section-block"><div class="section-title"><h3>MV</h3></div><div class="card-grid">${mvs.map((mv) => createCard(mv, 'mv')).join('')}</div></section>
    `;
    bindSongListEvents(document.getElementById('entity-content'), songs);
    bindEntityCards(document.getElementById('entity-content'));
    document.getElementById('entity-play-all').onclick = () => Player.playPlaylist(songs, 0);
    navigateTo('entity-detail');
}

async function openMv(id) {
    const { media, url } = await API.getMvDetail(id);
    openMediaDetail(media, url, 'MV');
}

async function openVideo(id) {
    const { media, url } = await API.getVideoDetail(id);
    openMediaDetail(media, url, '视频');
}

function openMediaDetail(media, url, label) {
    setEntityHeader({
        label,
        title: media?.name || `未知${label}`,
        subtitle: media?.creatorName || '',
        description: `${formatCount(media?.playCount || 0)} 次播放`,
        coverUrl: media?.coverUrl,
    });
    const mediaPlayer = document.getElementById('entity-media-player');
    if (url) {
        mediaPlayer.classList.remove('hidden');
        mediaPlayer.innerHTML = `<video controls src="${escapeAttribute(url)}" poster="${imageAttr(media?.coverUrl)}"></video>`;
    }
    document.getElementById('entity-content').innerHTML = '';
    navigateTo('entity-detail');
}

async function openDj(id) {
    const programs = await API.getDjPrograms(id, 30);
    const items = programs.programs || [];
    setEntityHeader({
        label: '电台',
        title: items[0]?.radio?.name || '电台节目',
        subtitle: `${items.length} 个节目`,
        description: items[0]?.radio?.desc || '',
        coverUrl: items[0]?.radio?.picUrl || '',
    });
    const songs = items.map((item) => API.normalizeSong({
        id: item.mainSong?.id,
        name: item.name,
        ar: [{ name: item.dj?.nickname || item.radio?.name || '电台' }],
        al: { picUrl: item.coverUrl || item.radio?.picUrl },
        dt: item.duration,
    })).filter(Boolean);
    document.getElementById('entity-content').innerHTML = `<div class="song-list">${createSongListHTML(songs)}</div>`;
    bindSongListEvents(document.getElementById('entity-content'), songs);
    navigateTo('entity-detail');
}

async function openLyrics(songId) {
    const song = await API.getSongDetail(songId).catch(() => null);
    const lyrics = await API.getSongLyrics(songId);
    const wordLyrics = await API.getSongWordLyrics(songId).catch(() => null);
    const lyricText = lyrics.lrc?.lyric || '暂无歌词';
    const translated = lyrics.tlyric?.lyric || '';
    setEntityHeader({
        label: '歌词',
        title: song?.name || `歌曲 ${songId}`,
        subtitle: song ? getArtistText(song) : '',
        description: wordLyrics?.yrc?.lyric ? '已加载逐字歌词' : '',
        coverUrl: song?.coverUrl,
        actions: song ? `<button class="btn btn-primary" id="entity-play-song"><i data-lucide="play"></i> 播放</button>` : '',
    });
    document.getElementById('entity-content').innerHTML = `
        <div class="lyrics-view">
            <pre>${escapeHtml(lyricText)}</pre>
            ${translated ? `<pre>${escapeHtml(translated)}</pre>` : ''}
        </div>
    `;
    if (song) document.getElementById('entity-play-song').onclick = () => Player.playSong(song);
    navigateTo('entity-detail');
}

function openCurrentSongDetail() {
    if (!Player.currentSong) {
        showToast('还没有正在播放的歌曲', 'error');
        return;
    }
    Player.detailLyricsVisible = false;
    Player.renderCurrentDetail();
    navigateTo('current-song-detail');
}

window.MusicAppNavigation = {
    navigateTo,
    openCurrentSongDetail,
    getCurrentPage: () => currentPage,
    getPreviousPage: () => previousPage,
};

async function importPlaylist() {
    const input = document.getElementById('import-playlist-url');
    const statusEl = document.getElementById('import-playlist-status');
    const btn = document.getElementById('btn-import-playlist');
    const value = input.value.trim();
    if (!value) return;

    btn.disabled = true;
    statusEl.textContent = '正在导入...';
    statusEl.className = 'import-status';
    statusEl.classList.remove('hidden');
    try {
        const result = await API.importPlaylist(value);
        statusEl.textContent = `导入成功：${result.name}`;
        statusEl.className = 'import-status success';
        input.value = '';
        showToast('歌单导入成功');
        await loadPlaylists();
        navigateTo('playlists');
    } catch (err) {
        statusEl.textContent = `导入失败：${err.message}`;
        statusEl.className = 'import-status error';
        showToast(err.message || '导入失败', 'error');
    } finally {
        btn.disabled = false;
    }
}

async function importSong() {
    const input = document.getElementById('import-song-url');
    const statusEl = document.getElementById('import-song-status');
    const btn = document.getElementById('btn-import-song');
    const value = input.value.trim();
    if (!value) return;

    btn.disabled = true;
    statusEl.textContent = '正在导入...';
    statusEl.className = 'import-status';
    statusEl.classList.remove('hidden');
    try {
        const result = await API.importSong(value);
        statusEl.textContent = `已读取歌曲：${result.name}`;
        statusEl.className = 'import-status success';
        input.value = '';
        showPlaylistPicker(result, '导入');
    } catch (err) {
        statusEl.textContent = `导入失败：${err.message}`;
        statusEl.className = 'import-status error';
        showToast(err.message || '导入失败', 'error');
    } finally {
        btn.disabled = false;
    }
}

function showCreatePlaylistModal() {
    document.getElementById('modal-create-playlist').classList.remove('hidden');
    document.getElementById('input-playlist-name').focus();
}

function hideCreatePlaylistModal() {
    document.getElementById('modal-create-playlist').classList.add('hidden');
    document.getElementById('input-playlist-name').value = '';
    document.getElementById('input-playlist-desc').value = '';
}

async function createPlaylist() {
    const name = document.getElementById('input-playlist-name').value.trim();
    const desc = document.getElementById('input-playlist-desc').value.trim();
    if (!name) {
        showToast('请输入歌单名称', 'error');
        return;
    }
    const btn = document.getElementById('btn-confirm-create');
    btn.disabled = true;
    try {
        await API.createPlaylist({ name, description: desc });
        hideCreatePlaylistModal();
        showToast('歌单创建成功');
        await loadPlaylists();
        navigateTo('playlists');
    } catch (err) {
        showToast(err.message || '创建失败', 'error');
    } finally {
        btn.disabled = false;
    }
}

async function showPlaylistPicker(song, action) {
    pendingSong = API.normalizeSong(song) || song;
    const modal = document.getElementById('modal-pick-playlist');
    const loadingEl = document.getElementById('pick-playlist-loading');
    const emptyEl = document.getElementById('pick-playlist-empty');
    const listEl = document.getElementById('pick-playlist-list');
    document.getElementById('pick-playlist-title').textContent = `${action}歌曲到歌单`;

    modal.classList.remove('hidden');
    loadingEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
    listEl.classList.add('hidden');
    listEl.innerHTML = '';

    try {
        const playlists = normalizePlaylistsResponse(await API.getPlaylists());
        loadingEl.classList.add('hidden');
        if (!playlists.length) {
            emptyEl.classList.remove('hidden');
            return;
        }
        listEl.classList.remove('hidden');
        listEl.innerHTML = playlists.map((playlist) => `
            <div class="pick-playlist-item" data-playlist-id="${playlist.id}">
                ${renderCover(playlist.coverUrl || playlist.cover_url, 'pick-playlist-item-cover', 'list-music', 120)}
                <div class="pick-playlist-item-info">
                    <div class="pick-playlist-item-name">${escapeHtml(playlist.name)}</div>
                    <div class="pick-playlist-item-count">${getPlaylistSongCount(playlist)} 首</div>
                </div>
                <i data-lucide="chevron-right"></i>
            </div>
        `).join('');
        listEl.querySelectorAll('.pick-playlist-item').forEach((item) => {
            item.addEventListener('click', () => addSongToPlaylist(Number(item.dataset.playlistId)));
        });
        lucide.createIcons();
    } catch (err) {
        showToast(err.message || '加载歌单失败', 'error');
        hidePlaylistPicker();
    }
}

function hidePlaylistPicker() {
    document.getElementById('modal-pick-playlist').classList.add('hidden');
    pendingSong = null;
}

async function addSongToPlaylist(playlistId) {
    if (!pendingSong) return;
    try {
        await API.addSongToPlaylist(playlistId, pendingSong);
        hidePlaylistPicker();
        showToast('歌曲已添加');
        await loadPlaylists();
        if (currentPlaylistId === playlistId) openPlaylistDetail(playlistId);
    } catch (err) {
        showToast(err.message || '添加失败', 'error');
    }
}

function showQuickCreatePlaylistModal() {
    document.getElementById('modal-pick-playlist').classList.add('hidden');
    document.getElementById('modal-quick-create-playlist').classList.remove('hidden');
    document.getElementById('input-quick-playlist-name').focus();
}

function hideQuickCreatePlaylistModal() {
    document.getElementById('modal-quick-create-playlist').classList.add('hidden');
    document.getElementById('input-quick-playlist-name').value = '';
    document.getElementById('input-quick-playlist-desc').value = '';
}

async function quickCreatePlaylist() {
    const name = document.getElementById('input-quick-playlist-name').value.trim();
    const desc = document.getElementById('input-quick-playlist-desc').value.trim();
    if (!name) {
        showToast('请输入歌单名称', 'error');
        return;
    }
    try {
        const playlist = await API.createPlaylist({ name, description: desc });
        if (pendingSong) await API.addSongToPlaylist(playlist.id, pendingSong);
        hideQuickCreatePlaylistModal();
        pendingSong = null;
        showToast('歌单已创建');
        await loadPlaylists();
        navigateTo('playlists');
    } catch (err) {
        showToast(err.message || '创建失败', 'error');
    }
}

async function loadDesktopVersion() {
    const summaryEl = document.getElementById('desktop-version-summary');
    const detailsEl = document.getElementById('desktop-version-details');
    const linkEl = document.getElementById('desktop-download-link');
    if (!summaryEl || !detailsEl || !linkEl) return;

    const versionUrl = window.NCM_VERSION_URL || '/downloads/version.json';
    summaryEl.textContent = '正在读取版本信息...';
    detailsEl.textContent = '';
    linkEl.classList.add('disabled');
    linkEl.setAttribute('href', '#');

    try {
        const res = await fetch(versionUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const meta = await res.json();
        const file = meta.file || 'MusicPlayer-Setup.exe';
        const releasedAt = meta.releasedAt ? new Date(meta.releasedAt).toLocaleString('zh-CN') : '未知时间';
        summaryEl.textContent = `最新版本 ${meta.version || '未知'}，发布于 ${releasedAt}`;
        linkEl.href = `/downloads/${encodeURIComponent(file)}`;
        linkEl.download = file;
        linkEl.classList.remove('disabled');
        detailsEl.innerHTML = `
            <div>文件：<code>${escapeHtml(file)}</code></div>
            <div>SHA256：<code>${escapeHtml(meta.sha256 || '构建后生成')}</code></div>
            <div>说明：${escapeHtml(meta.notes || 'Windows x64 桌面安装包')}</div>
        `;
    } catch (err) {
        summaryEl.textContent = '暂无可下载的桌面版安装包。';
        detailsEl.textContent = '请先运行桌面端构建和发布脚本生成安装包元数据。';
    }

    lucide.createIcons();
}

function bindStaticEvents() {
    document.addEventListener('error', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLImageElement) || target.dataset.fallbackApplied) return;
        target.dataset.fallbackApplied = 'true';
        target.classList.add('is-broken');
        target.removeAttribute('src');
    }, true);

    document.querySelectorAll('.nav-item').forEach((item) => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            navigateTo(item.dataset.page);
        });
    });

    document.getElementById('btn-refresh-discover')?.addEventListener('click', () => loadDiscover(true));
    document.getElementById('btn-refresh-desktop-version')?.addEventListener('click', () => loadDesktopVersion());
    document.querySelectorAll('.section-more').forEach((button) => {
        button.addEventListener('click', () => openMoreSection(button.dataset.moreSection));
    });
    document.getElementById('btn-search')?.addEventListener('click', performSearch);
    document.getElementById('search-input')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') performSearch();
    });
    document.getElementById('search-type')?.addEventListener('change', (event) => {
        document.querySelectorAll('#search-tabs .tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.searchType === event.target.value);
        });
    });
    document.querySelectorAll('#search-tabs .tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.getElementById('search-type').value = tab.dataset.searchType;
            document.querySelectorAll('#search-tabs .tab').forEach((item) => item.classList.toggle('active', item === tab));
            if (document.getElementById('search-input').value.trim()) performSearch();
        });
    });

    document.getElementById('btn-back-playlists')?.addEventListener('click', () => navigateTo('playlists'));
    document.getElementById('btn-back-entity')?.addEventListener('click', () => navigateTo(previousPage || 'home', { keepPrevious: true }));
    document.getElementById('btn-back-current-song')?.addEventListener('click', () => navigateTo(previousPage || 'home', { keepPrevious: true }));
    document.getElementById('player-current-entry')?.addEventListener('click', () => {
        if (currentPage === 'current-song-detail') {
            navigateTo(previousPage || 'home', { keepPrevious: true });
            return;
        }
        openCurrentSongDetail();
    });

    document.getElementById('btn-create-playlist')?.addEventListener('click', showCreatePlaylistModal);
    document.getElementById('btn-close-modal')?.addEventListener('click', hideCreatePlaylistModal);
    document.getElementById('btn-cancel-create')?.addEventListener('click', hideCreatePlaylistModal);
    document.getElementById('btn-confirm-create')?.addEventListener('click', createPlaylist);
    document.getElementById('input-playlist-name')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') createPlaylist();
    });
    document.getElementById('modal-create-playlist')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) hideCreatePlaylistModal();
    });

    document.getElementById('btn-import-playlist')?.addEventListener('click', importPlaylist);
    document.getElementById('btn-import-song')?.addEventListener('click', importSong);
    document.getElementById('import-playlist-url')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') importPlaylist();
    });
    document.getElementById('import-song-url')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') importSong();
    });

    document.getElementById('btn-close-pick-playlist')?.addEventListener('click', hidePlaylistPicker);
    document.getElementById('modal-pick-playlist')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) hidePlaylistPicker();
    });
    document.getElementById('btn-pick-create-playlist')?.addEventListener('click', showQuickCreatePlaylistModal);
    document.getElementById('btn-close-quick-create')?.addEventListener('click', hideQuickCreatePlaylistModal);
    document.getElementById('btn-cancel-quick-create')?.addEventListener('click', hideQuickCreatePlaylistModal);
    document.getElementById('btn-confirm-quick-create')?.addEventListener('click', quickCreatePlaylist);
    document.getElementById('modal-quick-create-playlist')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) hideQuickCreatePlaylistModal();
    });

    document.getElementById('btn-close-confirm')?.addEventListener('click', () => closeConfirmDialog(false));
    document.getElementById('btn-cancel-confirm')?.addEventListener('click', () => closeConfirmDialog(false));
    document.getElementById('btn-confirm-action')?.addEventListener('click', () => closeConfirmDialog(true));
    document.getElementById('modal-confirm')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closeConfirmDialog(false);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    Player.init();
    bindStaticEvents();
    await checkBackend();
    await loadPlaylists();
    await loadDiscover();
});
