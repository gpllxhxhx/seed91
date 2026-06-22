const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
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
let cleanupStarted = false;

app.isQuitting = false;

function serializeError(error) {
  if (!error) return 'unknown error';
  if (error instanceof Error) return error.stack || error.message;
  return String(error);
}

function getEnvironmentInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    hostname: os.hostname(),
    isPackaged: Boolean(app.isPackaged),
    appPath: app.getAppPath(),
    userDataPath: app.getPath('userData'),
  };
}

function showFriendlyRuntimeError(title, message, detail) {
  if (!app.isReady()) return;
  const safeMessage = String(message || '程序遇到错误，请稍后重试。');
  const safeDetail = String(detail || '');
  dialog.showMessageBox({
    type: 'error',
    title,
    message: safeMessage,
    detail: safeDetail,
    buttons: ['知道了'],
    noLink: true,
  }).catch(() => {});
}

function logUnhandledError(scope, error) {
  const details = { scope, error: serializeError(error) };
  logger?.error('unhandled runtime error', details);
}

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
      const stream = fs.createReadStream(filePath);
      stream.on('error', (error) => {
        logger?.error('frontend resource stream failed', { filePath, error: serializeError(error) });
        if (!res.headersSent) res.writeHead(500);
        res.end('Resource load failed');
      });
      stream.pipe(res);
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

function registerIpcHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    logger?.info('ipc invoke received', { channel });
    try {
      return await handler(event, ...args);
    } catch (error) {
      logger?.error('ipc invoke failed', { channel, error: serializeError(error) });
      throw error;
    }
  });
}

function setupIpc() {
  registerIpcHandler('playback:get-state', () => playbackService.getState());
  registerIpcHandler('pet:get-package', () => ({
    manifest: petPackage?.manifest || null,
    assetBaseUrl: petPackage?.assetBaseUrl || '',
  }));
  registerIpcHandler('playback:toggle', () => actions.togglePlayback());
  registerIpcHandler('playback:play', () => playbackService.play());
  registerIpcHandler('playback:pause', () => playbackService.pause());
  registerIpcHandler('playback:next', () => actions.next());
  registerIpcHandler('playback:previous', () => actions.previous());
  registerIpcHandler('playback:seek', (_event, seconds) => playbackService.seek(Number(seconds)));
  registerIpcHandler('player:open', () => actions.openPlayer());
  registerIpcHandler('lyric:get-config', () => configStore.get('lyric'));
  registerIpcHandler('lyric:toggle', () => actions.toggleLyric());
  registerIpcHandler('lyric:show', () => lyricWindow.show());
  registerIpcHandler('lyric:hide', () => lyricWindow.hide());
  registerIpcHandler('lyric:lock', () => lyricWindow.setLocked(true));
  registerIpcHandler('lyric:unlock', () => lyricWindow.setLocked(false));
  registerIpcHandler('app:quit', () => actions.quit());
  registerIpcHandler('desktop:config:get', () => configStore.get());
  registerIpcHandler('desktop:config:update', (_event, patch) => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new Error('配置更新参数无效');
    }
    return configStore.merge(patch);
  });

  ipcMain.on('desktop:log:report', (_event, entry) => {
    const level = entry?.level === 'error' ? 'error' : (entry?.level === 'warn' ? 'warn' : 'info');
    const message = entry?.message || 'renderer log';
    const meta = {
      scope: entry?.scope || 'renderer',
      ...(entry?.meta ? { meta: entry.meta } : {}),
    };
    logger?.[level]?.(`renderer: ${message}`, meta);
  });

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
  logger.info('desktop api base url ready', { apiBaseUrl });
  petPackage = loadPetPackage({
    app,
    petId: configStore.get('pet')?.selectedSkin || configStore.get('pet')?.skin || 'default',
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
  if (cleanupStarted) return;
  cleanupStarted = true;
  app.isQuitting = true;
  logger?.info('cleanup started');
  petWindow?.savePosition?.();
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
  logger.info('desktop app starting', getEnvironmentInfo());
  configStore = new ConfigStore(app, logger);
  configStore.load();
  if (configStore.lastLoadUsedDefaults) {
    showFriendlyRuntimeError('Music Pet 配置提示', '本地配置读取失败，已使用默认设置。');
  }
  playbackService = new PlaybackService(logger);

  bootstrap().catch((err) => {
    logger?.error('bootstrap failed', { error: err?.stack || err?.message || String(err) });
    cleanup();
    createErrorWindow(err);
  });
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  logger?.info('before-quit received');
  cleanup();
});
app.on('render-process-gone', (_event, webContents, details) => {
  logger?.error('render process gone', {
    reason: details?.reason,
    exitCode: details?.exitCode,
    url: webContents?.getURL?.(),
  });
  showFriendlyRuntimeError('Music Pet 运行异常', '渲染进程意外退出，请重新打开软件。', `${details?.reason || 'unknown'} (${details?.exitCode ?? 'n/a'})`);
});
app.on('child-process-gone', (_event, details) => {
  logger?.warn('child process gone', details || {});
});
app.on('web-contents-created', (_event, webContents) => {
  webContents.on('did-fail-load', (_loadEvent, errorCode, errorDescription, validatedURL) => {
    logger?.error('web contents did-fail-load', { errorCode, errorDescription, validatedURL });
  });
  webContents.on('unresponsive', () => {
    logger?.warn('web contents unresponsive', { url: webContents.getURL?.() });
  });
});
process.on('uncaughtException', (error) => {
  logUnhandledError('uncaughtException', error);
  showFriendlyRuntimeError('Music Pet 遇到错误', '程序出现未处理异常，请重新打开软件。', serializeError(error));
});
process.on('unhandledRejection', (reason) => {
  logUnhandledError('unhandledRejection', reason);
});
process.on('exit', (code) => {
  logger?.info('process exit', { code, exitedAt: new Date().toISOString() });
  cleanup();
});
process.on('SIGINT', () => {
  cleanup();
  app.quit();
});
process.on('SIGTERM', () => {
  cleanup();
  app.quit();
});
