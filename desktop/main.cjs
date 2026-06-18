const { app, BrowserWindow, ipcMain } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const { ApiProcessService, HOST } = require('./main/services/api-process-service.cjs');
const { ConfigStore } = require('./main/services/config-store.cjs');
const { Logger } = require('./main/services/logger.cjs');
const { loadPetPackage } = require('./main/services/pet-package-service.cjs');
const { PlaybackService } = require('./main/services/playback-service.cjs');
const { PetWindow } = require('./main/windows/pet-window.cjs');
const { LyricWindow } = require('./main/windows/lyric-window.cjs');
const { PlayerWindow } = require('./main/windows/player-window.cjs');
const { createTray, createAppMenu } = require('./main/tray.cjs');

let frontendServer = null;
let frontendPort = 0;
let apiService = null;
let apiBaseUrl = '';
let desktopToken = '';
let configStore = null;
let logger = null;
let playbackService = null;
let petPackage = null;
let petWindow = null;
let lyricWindow = null;
let playerWindow = null;
let tray = null;

app.isQuitting = false;

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.exe': 'application/vnd.microsoft.portable-executable',
  }[ext] || 'application/octet-stream';
}

function resolveFrontendPath(frontendDir, urlPath) {
  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }

  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const absolutePath = path.resolve(frontendDir, relativePath);
  const relativeToFrontend = path.relative(frontendDir, absolutePath);
  if (relativeToFrontend.startsWith('..') || path.isAbsolute(relativeToFrontend)) return null;
  return absolutePath;
}

function createFrontendServer() {
  const frontendDir = path.join(app.getAppPath(), 'frontend');
  logger?.info('creating frontend server', { frontendDir });

  frontendServer = http.createServer((req, res) => {
    const requestPath = req.url || '/';
    if (requestPath.split('?')[0] === '/js/config.js') {
      const body = [
        `window.NCM_API_BASE = ${JSON.stringify(apiBaseUrl)};`,
        `window.NCM_API_TOKEN = ${JSON.stringify(desktopToken)};`,
        'window.NCM_DESKTOP = true;',
        "window.NCM_VERSION_URL = '/downloads/version.json';",
      ].join('\n');
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
      return;
    }

    const filePath = resolveFrontendPath(frontendDir, requestPath);
    if (!filePath) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      res.writeHead(200, {
        'Content-Type': getMimeType(filePath),
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve, reject) => {
    frontendServer.once('error', reject);
    frontendServer.listen(0, HOST, () => {
      frontendServer.off('error', reject);
      frontendPort = frontendServer.address().port;
      logger?.info('frontend server ready', { url: `http://${HOST}:${frontendPort}` });
      resolve(frontendPort);
    });
  });
}

function broadcastPlaybackState(state) {
  petWindow?.send('playback:state-changed', state);
  lyricWindow?.send('playback:state-changed', state);
}

function buildMenu() {
  const lyricConfig = configStore.get('lyric');
  return createAppMenu(actions, {
    status: playbackService.getState().status,
    lyricVisible: lyricConfig.visible,
    lyricLocked: lyricConfig.locked,
  });
}

const actions = {
  togglePlayback() {
    ensurePlayerForCommand();
    playbackService.toggle();
  },
  previous() {
    ensurePlayerForCommand();
    playbackService.previous();
  },
  next() {
    ensurePlayerForCommand();
    playbackService.next();
  },
  openPlayer() {
    playerWindow.show();
  },
  toggleLyric() {
    lyricWindow.toggle();
    refreshTrayMenu();
  },
  toggleLyricLock() {
    const locked = !configStore.get('lyric').locked;
    lyricWindow.setLocked(locked);
    refreshTrayMenu();
  },
  quit() {
    app.isQuitting = true;
    app.quit();
  },
};

function refreshTrayMenu() {
  if (tray) tray.setContextMenu(buildMenu());
}

function ensurePlayerForCommand() {
  if (!playerWindow.window || playerWindow.window.isDestroyed()) {
    playerWindow.show();
    return;
  }
  if (!playerWindow.window.webContents.isLoadingMainFrame()) return;
}

function setupIpc() {
  ipcMain.handle('playback:get-state', () => playbackService.getState());
  ipcMain.handle('pet:get-package', () => ({
    manifest: petPackage?.manifest || null,
    assetBaseUrl: petPackage?.assetBaseUrl || '',
  }));
  ipcMain.handle('playback:toggle', () => actions.togglePlayback());
  ipcMain.handle('playback:play', () => playbackService.play());
  ipcMain.handle('playback:pause', () => playbackService.pause());
  ipcMain.handle('playback:next', () => actions.next());
  ipcMain.handle('playback:previous', () => actions.previous());
  ipcMain.handle('playback:seek', (_event, seconds) => playbackService.seek(Number(seconds)));
  ipcMain.handle('player:open', () => actions.openPlayer());
  ipcMain.handle('lyric:get-config', () => configStore.get('lyric'));
  ipcMain.handle('lyric:toggle', () => actions.toggleLyric());
  ipcMain.handle('lyric:show', () => lyricWindow.show());
  ipcMain.handle('lyric:hide', () => lyricWindow.hide());
  ipcMain.handle('lyric:lock', () => lyricWindow.setLocked(true));
  ipcMain.handle('lyric:unlock', () => lyricWindow.setLocked(false));
  ipcMain.handle('app:quit', () => actions.quit());

  ipcMain.on('player:state-update', (_event, state) => {
    playbackService.updateFromRenderer(state || {});
  });
}

function wirePlayback() {
  playbackService.on('state-changed', (state) => {
    broadcastPlaybackState(state);
    refreshTrayMenu();
  });

  playbackService.on('command', (payload) => {
    const sent = playerWindow?.send('playback:command', payload);
    if (!sent) {
      logger?.warn('playback command dropped because player window is not ready', payload);
      playerWindow.show();
    }
  });
}

function createErrorWindow(err) {
  const errorWindow = new BrowserWindow({
    width: 760,
    height: 420,
    show: false,
    backgroundColor: '#080607',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  const message = String(err?.message || err || '本地服务启动失败');
  errorWindow.once('ready-to-show', () => errorWindow.show());
  errorWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!doctype html>
    <meta charset="utf-8">
    <title>Music Pet 启动失败</title>
    <body style="margin:0;background:#080607;color:#f7f2f3;font-family:Segoe UI,Microsoft YaHei,sans-serif;display:grid;place-items:center;min-height:100vh">
      <main style="max-width:560px;padding:32px">
        <h1 style="font-size:24px;margin:0 0 14px">Music Pet 启动失败</h1>
        <p style="color:#c9b9be;line-height:1.7">本地音乐 API 没有成功启动。请关闭后重新打开应用，或检查安全软件是否拦截了本地回环网络。</p>
        <pre style="white-space:pre-wrap;background:#140f12;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:14px;color:#ff9aa8">${message}</pre>
      </main>
    </body>
  `)}`);
}

async function bootstrap() {
  logger.info('app bootstrap started');
  desktopToken = crypto.randomBytes(32).toString('hex');
  await createFrontendServer();

  apiService = new ApiProcessService({
    app,
    token: desktopToken,
    frontendPort,
    logger,
  });
  const apiInfo = await apiService.start();
  apiBaseUrl = apiInfo.baseUrl;
  petPackage = loadPetPackage({
    app,
    petId: configStore.get('pet')?.skin || 'default',
  });

  playerWindow = new PlayerWindow({
    app,
    frontendUrl: `http://${HOST}:${frontendPort}/`,
    logger,
  });
  petWindow = new PetWindow({ app, config: configStore, logger, buildMenu, petPackage });
  lyricWindow = new LyricWindow({ app, config: configStore, logger });

  setupIpc();
  wirePlayback();

  petWindow.create();
  lyricWindow.create();
  tray = createTray({ buildMenu });
  broadcastPlaybackState(playbackService.getState());
  logger.info('app bootstrap completed');
}

function cleanup() {
  app.isQuitting = true;
  logger?.info('cleanup started');
  if (frontendServer) {
    frontendServer.close();
    frontendServer = null;
  }
  apiService?.stop();
  logger?.info('cleanup completed');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (playerWindow) actions.openPlayer();
});

app.whenReady().then(() => {
  logger = new Logger(app);
  logger.init();
  configStore = new ConfigStore(app, logger);
  configStore.load();
  playbackService = new PlaybackService(logger);

  bootstrap().catch((err) => {
    logger?.error('bootstrap failed', { error: err?.stack || err?.message || String(err) });
    cleanup();
    createErrorWindow(err);
  });
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  cleanup();
});
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  app.quit();
});
process.on('SIGTERM', () => {
  cleanup();
  app.quit();
});
