import "./style.css";
import {
  getCurrentWindow,
  LogicalSize,
  monitorFromPoint,
  PhysicalPosition,
  primaryMonitor,
  type Monitor,
  type Window
} from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo, listen } from "@tauri-apps/api/event";
import {
  renderApp,
  renderContextMenuApp,
  renderPlaylistPickerApp,
  renderSongPickerApp
} from "./App";
import { bindPetWindowInteractions } from "./pet-window";
import {
  createPlaybackController,
  type PlaybackSong
} from "./playback-controller";
import { createSongUrlResolver } from "./song-url-resolver";
import {
  createPlaylistResolver,
  parsePlaylistId,
  type ResolvedPlaylist
} from "./playlist-resolver";
import {
  addSavedPlaylist,
  buildSavedPlaylist,
  deleteSavedPlaylist,
  findSavedPlaylist,
  savedPlaylistToResolvedPlaylist
} from "./playlist-library";
import {
  getPersistedPlaylistRequest,
  populatePlaylistSession
} from "./playlist-session";
import {
  applyWindowPreferences,
  getStoragePaths,
  openConfigDirectory,
  openLogDirectory,
  readUserConfig,
  resetUserConfig,
  updateUserConfig,
  type UserConfigPatch
} from "./desktop-client";
import {
  getConfigFallbackMessage,
  getPlaybackFriendlyMessage,
  getPlaylistFriendlyMessage
} from "./friendly-messages";
import { createLogger } from "./logger";
import { createNotifier } from "./notify";
import {
  defaultUserConfig,
  type PersistedSong,
  type SavedPlaylist,
  type UserConfig
} from "./user-config";
import {
  clampWindowPositionToArea,
  getWindowSizeWithPetScale,
  type ContextMenuPosition,
  type UiLayoutState
} from "./ui-layout";

const DEFAULT_SONG: PlaybackSong = {
  id: "1496089152",
  name: "默认测试歌曲"
};
const DEFAULT_PET_FRAME_WIDTH = 220;
const DEFAULT_PET_FRAME_HEIGHT = 220;

type AppRefs = {
  shell: HTMLElement;
  currentSong: HTMLElement;
  currentPlaylist: HTMLElement;
  petStage: HTMLElement;
  petSurface: HTMLElement;
  playbackError: HTMLElement;
  playbackStatus: HTMLElement;
  notificationStack: HTMLElement;
  settingsPanel: HTMLElement;
  settingsClose: HTMLButtonElement;
  settingAlwaysOnTop: HTMLInputElement;
  settingOpacity: HTMLInputElement;
  settingPetSize: HTMLInputElement;
  settingVolume: HTMLInputElement;
  settingMuted: HTMLInputElement;
  settingSkin: HTMLSelectElement;
  openLogDir: HTMLButtonElement;
  openConfigDir: HTMLButtonElement;
  resetSettings: HTMLButtonElement;
};

type ContextMenuAction =
  | "toggle-playback"
  | "switch-playlist"
  | "switch-song"
  | "open-settings"
  | "toggle-always-on-top"
  | "open-log-dir"
  | "exit";

type MenuRefs = {
  playback: HTMLButtonElement;
  switchPlaylist: HTMLButtonElement;
  switchSong: HTMLButtonElement;
  settings: HTMLButtonElement;
  alwaysOnTop: HTMLButtonElement;
  openLogDir: HTMLButtonElement;
  exit: HTMLButtonElement;
};

type PickerKind = "playlist" | "song";

type PickerWindowPayload = {
  kind: PickerKind;
  playlists: UserConfig["player"]["savedPlaylists"];
  currentPlaylistId: string | null;
  currentSongId: string | null;
};

type PickerActionPayload = {
  kind?: PickerKind;
  action?: "import-playlist" | "play-playlist" | "delete-playlist" | "play-song" | "back" | "close";
  playlistId?: string;
  songId?: number;
  rawInput?: string;
};

const MENU_WINDOW_LABEL = "pet-menu";
const PLAYLIST_PICKER_WINDOW_LABEL = "pet-playlist-picker";
const SONG_PICKER_WINDOW_LABEL = "pet-song-picker";
const MENU_WINDOW_SIZE = {
  width: 190,
  height: 318
};
const PICKER_WINDOW_SIZE = {
  playlist: { width: 360, height: 430 },
  song: { width: 340, height: 430 }
};
const currentWindow = getCurrentWindow();

type HideableWindow = {
  hide: () => Promise<void>;
  close: () => Promise<void>;
};

const FLOATING_WINDOW_LABELS = [
  MENU_WINDOW_LABEL,
  PLAYLIST_PICKER_WINDOW_LABEL,
  SONG_PICKER_WINDOW_LABEL
];

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("App root element was not found.");
}

const appRoot = root;

function queryRequiredElement<T extends Element>(
  parent: ParentNode,
  selector: string,
  label: string
): T {
  const element = parent.querySelector<T>(selector);

  if (!element) {
    throw new Error(`${label} was not found.`);
  }

  return element;
}

function collectRefs(parent: ParentNode): AppRefs {
  return {
    shell: queryRequiredElement(parent, "[data-ui-state]", "Pet shell"),
    currentSong: queryRequiredElement(parent, "[data-current-song]", "Current song element"),
    currentPlaylist: queryRequiredElement(parent, "[data-current-playlist]", "Current playlist element"),
    petStage: queryRequiredElement(parent, "[data-playback-state]", "Pet stage element"),
    petSurface: queryRequiredElement(parent, "[data-pet-surface]", "Pet surface element"),
    playbackError: queryRequiredElement(parent, "[data-playback-error]", "Playback error element"),
    playbackStatus: queryRequiredElement(parent, "[data-playback-status]", "Playback status element"),
    notificationStack: queryRequiredElement(parent, "[data-notification-stack]", "Notification stack"),
    settingsPanel: queryRequiredElement(parent, "[data-settings-panel]", "Settings panel"),
    settingsClose: queryRequiredElement(parent, "[data-settings-close]", "Settings close"),
    settingAlwaysOnTop: queryRequiredElement(parent, "[data-setting-always-on-top]", "Always on top setting"),
    settingOpacity: queryRequiredElement(parent, "[data-setting-opacity]", "Opacity setting"),
    settingPetSize: queryRequiredElement(parent, "[data-setting-pet-size]", "Pet size setting"),
    settingVolume: queryRequiredElement(parent, "[data-setting-volume]", "Setting volume"),
    settingMuted: queryRequiredElement(parent, "[data-setting-muted]", "Setting muted"),
    settingSkin: queryRequiredElement(parent, "[data-setting-skin]", "Skin setting"),
    openLogDir: queryRequiredElement(parent, "[data-open-log-dir]", "Open log dir"),
    openConfigDir: queryRequiredElement(parent, "[data-open-config-dir]", "Open config dir"),
    resetSettings: queryRequiredElement(parent, "[data-reset-settings]", "Reset settings")
  };
}

function collectMenuRefs(parent: ParentNode): MenuRefs {
  return {
    playback: queryRequiredElement(parent, "[data-context-playback]", "Menu playback"),
    switchPlaylist: queryRequiredElement(parent, "[data-context-switch-playlist]", "Menu switch playlist"),
    switchSong: queryRequiredElement(parent, "[data-context-switch-song]", "Menu switch song"),
    settings: queryRequiredElement(parent, "[data-context-settings]", "Menu settings"),
    alwaysOnTop: queryRequiredElement(parent, "[data-context-always-on-top]", "Menu always on top"),
    openLogDir: queryRequiredElement(parent, "[data-context-open-log-dir]", "Menu open log dir"),
    exit: queryRequiredElement(parent, "[data-context-exit]", "Menu exit")
  };
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function roundVolume(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildPersistedSong(
  song: PlaybackSong,
  artistsBySongId: Map<string, string>,
  audio: HTMLAudioElement
): PersistedSong {
  return {
    songId: String(song.id),
    songName: song.name,
    artist: artistsBySongId.get(String(song.id)) ?? "",
    cover: "",
    progress: Number.isFinite(audio.currentTime) ? Math.floor(audio.currentTime) : null
  };
}

function applyPersistedAudioPreferences(
  audio: HTMLAudioElement,
  config: UserConfig
): void {
  audio.volume = config.player.volume;
  audio.muted = config.player.muted;
}

function describeUrlForLog(url: string): Record<string, string> {
  try {
    const parsedUrl = new URL(url);
    return {
      host: parsedUrl.host,
      protocol: parsedUrl.protocol
    };
  } catch {
    return {
      host: "unknown",
      protocol: "unknown"
    };
  }
}

function setCurrentSongLabel(target: HTMLElement, song: PlaybackSong | null): void {
  target.textContent = song ? `当前歌曲：${song.name}` : "当前歌曲：未选择";
}

function setCurrentPlaylistLabel(target: HTMLElement, playlistName: string | null): void {
  target.textContent = playlistName ? `当前歌单：${playlistName}` : "当前歌单：未选择";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPlaylistCoverText(playlistName: string): string {
  const trimmedName = playlistName.trim();
  return trimmedName ? trimmedName.slice(0, 1) : "♪";
}

function renderPlaylistCover(playlist: SavedPlaylist): string {
  if (playlist.cover) {
    return `
      <span class="picker-cover" aria-hidden="true">
        <img
          class="picker-cover-image"
          src="${escapeHtml(playlist.cover)}"
          alt=""
          loading="lazy"
          draggable="false"
        />
      </span>
    `.trim();
  }

  return `
    <span class="picker-cover picker-cover-fallback" aria-hidden="true">
      ${escapeHtml(getPlaylistCoverText(playlist.name))}
    </span>
  `.trim();
}

function renderPickerPlaylists(
  container: HTMLElement,
  payload: PickerWindowPayload
): void {
  if (payload.playlists.length === 0) {
    container.innerHTML = `
      <p class="picker-empty">还没有保存歌单，可以在上方导入。</p>
    `.trim();
    return;
  }

  container.innerHTML = payload.playlists
    .map((playlist) => {
      const isCurrent = playlist.id === payload.currentPlaylistId;

      return `
        <article
          class="picker-playlist-tile${isCurrent ? " is-current" : ""}"
        >
          ${renderPlaylistCover(playlist)}
          <span class="picker-playlist-name">${escapeHtml(playlist.name)}</span>
          <span class="picker-playlist-count">${playlist.trackCount} 首</span>
          ${isCurrent ? '<span class="picker-current-badge">当前</span>' : ""}
          <div class="picker-playlist-actions">
            <button
              type="button"
              class="picker-playlist-action"
              data-picker-action="play-playlist"
              data-playlist-id="${escapeHtml(playlist.id)}"
              title="${escapeHtml(playlist.name)}"
            >
              播放
            </button>
            <button
              type="button"
              class="picker-playlist-action danger-soft"
              data-picker-action="delete-playlist"
              data-playlist-id="${escapeHtml(playlist.id)}"
              title="删除 ${escapeHtml(playlist.name)}"
            >
              删除
            </button>
          </div>
        </article>
      `.trim();
    })
    .join("");
}

function renderPickerSongs(
  container: HTMLElement,
  payload: PickerWindowPayload
): void {
  const currentPlaylist = findSavedPlaylist(
    payload.playlists,
    payload.currentPlaylistId
  );

  if (!currentPlaylist) {
    container.innerHTML = `
      <p class="picker-empty">请先选择一个歌单。</p>
    `.trim();
    return;
  }

  container.innerHTML = currentPlaylist.tracks
    .map((song) => {
      const isCurrent = String(song.id) === payload.currentSongId;
      const songMeta = song.album
        ? `${song.artists} · ${song.album}`
        : song.artists;

      return `
        <button
          type="button"
          class="picker-song-row${isCurrent ? " is-current" : ""}"
          data-picker-action="play-song"
          data-song-id="${song.id}"
          ${isCurrent ? 'data-current-song-row="true"' : ""}
        >
          <span class="picker-song-name">${escapeHtml(song.name)}</span>
          <span class="picker-song-meta">${escapeHtml(songMeta)}</span>
          ${isCurrent ? '<span class="picker-current-badge">播放中</span>' : ""}
        </button>
      `.trim();
    })
    .join("");
}

function showPickerFeedback(
  element: HTMLElement,
  message: string,
  state: "idle" | "loading" | "error" = "idle"
): void {
  element.textContent = message;
  element.hidden = !message;
  element.dataset.state = state;
}

async function hideWindowSafely(targetWindow: HideableWindow): Promise<void> {
  try {
    await targetWindow.hide();
  } catch {
    await targetWindow.close();
  }
}

async function hideFloatingWindowByLabel(label: string): Promise<void> {
  const floatingWindow = await WebviewWindow.getByLabel(label);

  if (!floatingWindow) {
    return;
  }

  await hideWindowSafely(floatingWindow);
}

async function hideFloatingWindows(exceptLabel?: string): Promise<void> {
  await Promise.all(
    FLOATING_WINDOW_LABELS
      .filter((label) => label !== exceptLabel)
      .map((label) => hideFloatingWindowByLabel(label).catch(() => {}))
  );
}

async function emitMenuAction(action: ContextMenuAction): Promise<void> {
  await emitTo("main", "pet-menu-action", {
    action
  });
  await hideWindowSafely(currentWindow);
}

function bindMenuButton(
  button: HTMLButtonElement,
  action: ContextMenuAction
): void {
  button.addEventListener("click", () => {
    void emitMenuAction(action);
  });
}

function initializeMenuWindow(): void {
  appRoot.innerHTML = renderContextMenuApp();
  const refs = collectMenuRefs(appRoot);

  bindMenuButton(refs.playback, "toggle-playback");
  bindMenuButton(refs.switchPlaylist, "switch-playlist");
  bindMenuButton(refs.switchSong, "switch-song");
  bindMenuButton(refs.settings, "open-settings");
  bindMenuButton(refs.alwaysOnTop, "toggle-always-on-top");
  bindMenuButton(refs.openLogDir, "open-log-dir");
  bindMenuButton(refs.exit, "exit");

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      void hideWindowSafely(currentWindow);
    }
  });
}

async function emitPickerReady(kind: PickerKind): Promise<void> {
  await emitTo("main", "pet-picker-ready", {
    kind,
    label: currentWindow.label
  });
}

async function emitPickerAction(payload: PickerActionPayload): Promise<void> {
  await emitTo("main", "pet-picker-action", payload);
}

async function emitPickerActionWithFeedback(
  payload: PickerActionPayload,
  feedback?: HTMLElement
): Promise<boolean> {
  try {
    await emitPickerAction(payload);
    return true;
  } catch (error) {
    const message = "窗口通信失败，请关闭后重试。";

    if (feedback) {
      showPickerFeedback(feedback, message, "error");
    }

    console.error(message, error);
    return false;
  }
}

async function closePickerWindow(kind: PickerKind): Promise<void> {
  try {
    await hideWindowSafely(currentWindow);
  } catch (error) {
    console.error("选择器窗口关闭失败，尝试由主窗口关闭。", error);
    await emitPickerActionWithFeedback({
      kind,
      action: "close"
    });
  }
}

function initializePlaylistPickerWindow(): void {
  appRoot.innerHTML = renderPlaylistPickerApp();
  const closeButton = queryRequiredElement<HTMLButtonElement>(appRoot, "[data-picker-close]", "Picker close");
  const backButton = queryRequiredElement<HTMLButtonElement>(appRoot, "[data-picker-back]", "Picker back");
  const importForm = queryRequiredElement<HTMLFormElement>(appRoot, "[data-picker-import-form]", "Picker import form");
  const importInput = queryRequiredElement<HTMLInputElement>(appRoot, "[data-picker-import-input]", "Picker import input");
  const importSubmit = queryRequiredElement<HTMLButtonElement>(appRoot, "[data-picker-import-submit]", "Picker import submit");
  const feedback = queryRequiredElement<HTMLElement>(appRoot, "[data-picker-feedback]", "Picker feedback");
  const grid = queryRequiredElement<HTMLElement>(appRoot, "[data-picker-playlist-grid]", "Picker playlist grid");

  closeButton.addEventListener("click", () => {
    void closePickerWindow("playlist");
  });

  backButton.addEventListener("click", () => {
    void emitPickerActionWithFeedback({
        kind: "playlist",
        action: "back"
      },
      feedback
    );
    void closePickerWindow("playlist");
  });

  importForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const rawInput = importInput.value.trim();

    if (!rawInput) {
      showPickerFeedback(feedback, "请输入歌单链接或 ID。", "error");
      return;
    }

    showPickerFeedback(feedback, "正在导入歌单", "loading");
    importSubmit.disabled = true;
    const emitted = await emitPickerActionWithFeedback(
      {
        kind: "playlist",
        action: "import-playlist",
        rawInput
      },
      feedback
    );

    if (!emitted) {
      importSubmit.disabled = false;
    }
  });

  grid.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("[data-picker-action]");
    const playlistId = button?.dataset.playlistId;
    const action = button?.dataset.pickerAction;

    if (!playlistId || !action) {
      return;
    }

    void emitPickerAction({
      kind: "playlist",
      action: action as PickerActionPayload["action"],
      playlistId
    });
  });

  void listen<PickerWindowPayload>("pet-picker-data", (event) => {
    if (event.payload.kind !== "playlist") {
      return;
    }

    renderPickerPlaylists(grid, event.payload);
  });

  void listen<{ kind?: PickerKind; message?: string; state?: "idle" | "loading" | "error" }>(
    "pet-picker-feedback",
    (event) => {
      if (event.payload.kind !== "playlist") {
        return;
      }

      showPickerFeedback(
        feedback,
        event.payload.message ?? "",
        event.payload.state ?? "idle"
      );
      importSubmit.disabled = event.payload.state === "loading";

      if (event.payload.state === "idle") {
        importInput.value = "";
      }
    }
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      void closePickerWindow("playlist");
    }
  });

  void emitPickerReady("playlist");
}

function initializeSongPickerWindow(): void {
  appRoot.innerHTML = renderSongPickerApp();
  const closeButton = queryRequiredElement<HTMLButtonElement>(appRoot, "[data-picker-close]", "Picker close");
  const backButton = queryRequiredElement<HTMLButtonElement>(appRoot, "[data-picker-back]", "Picker back");
  const locateButton = queryRequiredElement<HTMLButtonElement>(appRoot, "[data-locate-current-song]", "Locate current song");
  const feedback = queryRequiredElement<HTMLElement>(appRoot, "[data-picker-feedback]", "Picker feedback");
  const currentPlaylistSummary = queryRequiredElement<HTMLElement>(appRoot, "[data-picker-current-playlist]", "Picker current playlist");
  const currentSongSummary = queryRequiredElement<HTMLElement>(appRoot, "[data-picker-current-song]", "Picker current song");
  const list = queryRequiredElement<HTMLElement>(appRoot, "[data-picker-song-list]", "Picker song list");

  closeButton.addEventListener("click", () => {
    void closePickerWindow("song");
  });

  backButton.addEventListener("click", () => {
    void emitPickerActionWithFeedback(
      {
        kind: "song",
        action: "back"
      },
      feedback
    );
    void closePickerWindow("song");
  });

  locateButton.addEventListener("click", () => {
    const currentSongRow = list.querySelector<HTMLElement>("[data-current-song-row='true']");

    if (!currentSongRow) {
      showPickerFeedback(feedback, "当前没有正在播放的歌曲。", "error");
      return;
    }

    currentSongRow.scrollIntoView({
      block: "center",
      behavior: "smooth"
    });
    showPickerFeedback(feedback, "已定位到正在播放歌曲");
  });

  list.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("[data-picker-action='play-song']");
    const songId = Number(button?.dataset.songId);

    if (!Number.isFinite(songId)) {
      return;
    }

    void emitPickerAction({
      kind: "song",
      action: "play-song",
      songId
    });
  });

  void listen<PickerWindowPayload>("pet-picker-data", (event) => {
    if (event.payload.kind !== "song") {
      return;
    }

    const currentPlaylist = findSavedPlaylist(
      event.payload.playlists,
      event.payload.currentPlaylistId
    );
    const currentSong = currentPlaylist?.tracks.find(
      (song) => String(song.id) === event.payload.currentSongId
    );

    currentPlaylistSummary.textContent = currentPlaylist
      ? `当前歌单：${currentPlaylist.name}`
      : "当前歌单：未选择";
    currentSongSummary.textContent = currentSong
      ? `当前歌曲：${currentSong.name}`
      : "当前歌曲：未播放";
    renderPickerSongs(list, event.payload);
  });

  void listen<{ kind?: PickerKind; message?: string; state?: "idle" | "loading" | "error" }>(
    "pet-picker-feedback",
    (event) => {
      if (event.payload.kind !== "song") {
        return;
      }

      showPickerFeedback(
        feedback,
        event.payload.message ?? "",
        event.payload.state ?? "idle"
      );
    }
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      void closePickerWindow("song");
    }
  });

  void emitPickerReady("song");
}

async function getOrCreateMenuWindow(): Promise<WebviewWindow> {
  const existingWindow = await WebviewWindow.getByLabel(MENU_WINDOW_LABEL);

  if (existingWindow) {
    return existingWindow;
  }

  return new WebviewWindow(MENU_WINDOW_LABEL, {
    url: "/",
    title: "Music Pet Menu",
    width: MENU_WINDOW_SIZE.width,
    height: MENU_WINDOW_SIZE.height,
    decorations: false,
    transparent: true,
    shadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    visible: false,
    focus: true,
    parent: "main"
  });
}

function getPickerWindowLabel(kind: PickerKind): string {
  return kind === "playlist"
    ? PLAYLIST_PICKER_WINDOW_LABEL
    : SONG_PICKER_WINDOW_LABEL;
}

async function getOrCreatePickerWindow(kind: PickerKind): Promise<WebviewWindow> {
  const label = getPickerWindowLabel(kind);
  const existingWindow = await WebviewWindow.getByLabel(label);

  if (existingWindow) {
    return existingWindow;
  }

  const size = PICKER_WINDOW_SIZE[kind];

  return new WebviewWindow(label, {
    url: "/",
    title: kind === "playlist" ? "Music Pet Playlist Picker" : "Music Pet Song Picker",
    width: size.width,
    height: size.height,
    decorations: false,
    transparent: true,
    shadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    visible: false,
    focus: true,
    parent: "main"
  });
}

async function getMonitorForPosition(
  position: ContextMenuPosition
): Promise<Monitor | null> {
  return (await monitorFromPoint(position.x, position.y)) ?? (await primaryMonitor());
}

async function clampFloatingWindowPosition(
  position: ContextMenuPosition,
  size: { width: number; height: number }
): Promise<ContextMenuPosition> {
  const monitor = await getMonitorForPosition(position);

  if (!monitor) {
    return {
      x: Math.max(0, position.x),
      y: Math.max(0, position.y)
    };
  }

  const workArea = monitor.workArea ?? {
    position: monitor.position,
    size: monitor.size
  };
  const scaleFactor = monitor.scaleFactor || 1;

  return clampWindowPositionToArea(
    position,
    {
      width: Math.round(size.width * scaleFactor),
      height: Math.round(size.height * scaleFactor)
    },
    {
      x: workArea.position.x,
      y: workArea.position.y,
      width: workArea.size.width,
      height: workArea.size.height
    }
  );
}

async function showMenuWindow(
  ownerWindow: Window,
  position: { x: number; y: number }
): Promise<void> {
  await hideFloatingWindows(MENU_WINDOW_LABEL);
  const menuWindow = await getOrCreateMenuWindow();
  const ownerPosition = await ownerWindow.outerPosition();
  const preferredPosition = {
    x: ownerPosition.x + Math.round(position.x),
    y: ownerPosition.y + Math.round(position.y)
  };
  const clampedPosition = await clampFloatingWindowPosition(
    preferredPosition,
    MENU_WINDOW_SIZE
  );

  await menuWindow.setSize(new LogicalSize(MENU_WINDOW_SIZE.width, MENU_WINDOW_SIZE.height));
  await menuWindow.setPosition(
    new PhysicalPosition(
      clampedPosition.x,
      clampedPosition.y
    )
  );
  await menuWindow.show();
  await menuWindow.setFocus();
}

async function showPickerWindow(
  ownerWindow: Window,
  kind: PickerKind
): Promise<void> {
  await hideFloatingWindows(getPickerWindowLabel(kind));
  const pickerWindow = await getOrCreatePickerWindow(kind);
  const ownerPosition = await ownerWindow.outerPosition();
  const size = PICKER_WINDOW_SIZE[kind];
  const preferredPosition = {
    x: ownerPosition.x + 18,
    y: ownerPosition.y + 18
  };
  const clampedPosition = await clampFloatingWindowPosition(
    preferredPosition,
    size
  );

  await pickerWindow.setSize(new LogicalSize(size.width, size.height));
  await pickerWindow.setPosition(
    new PhysicalPosition(
      clampedPosition.x,
      clampedPosition.y
    )
  );
  await pickerWindow.show();
  await pickerWindow.setFocus();
}

async function bootstrap(): Promise<void> {
  const refs = collectRefs(appRoot);
  const notifier = createNotifier(refs.notificationStack);
  const logger = createLogger("desktop-pet-frontend");

  const registerGlobalErrorHandlers = () => {
    window.addEventListener("error", (event) => {
      const detail = {
        column: event.colno,
        fileName: event.filename,
        line: event.lineno,
        message: event.message
      };

      notifier.error("应用发生异常，请稍后重试。");
      void logger.error("前端未捕获异常", detail);
    });

    window.addEventListener("unhandledrejection", (event) => {
      const detail = getErrorMessage(event.reason, "未知 Promise 异常");

      notifier.error("应用发生异常，请稍后重试。");
      void logger.error("Promise 未处理异常", {
        detail
      });
    });
  };

  registerGlobalErrorHandlers();

  const apiBase = import.meta.env.VITE_MUSIC_API_BASE ?? "";

  await logger.info("软件启动", {
    apiBase
  });
  await logger.info("当前 API 地址", {
    apiBase
  });

  try {
    const storagePaths = await getStoragePaths();
    await logger.info("本地存储路径已就绪", storagePaths);
  } catch (error) {
    await logger.warn("读取本地存储路径失败", {
      detail: getErrorMessage(error, "未知错误")
    });
  }

  let currentConfig = structuredClone(defaultUserConfig);

  try {
    currentConfig = await readUserConfig();
  } catch (error) {
    const detail = getErrorMessage(error, "未知错误");

    notifier.warn(getConfigFallbackMessage("read"));
    await logger.warn("配置读取失败", {
      detail
    });
  }

  const initialSong: PlaybackSong =
    currentConfig.player.lastSong
      ? {
          id: currentConfig.player.lastSong.songId,
          name: currentConfig.player.lastSong.songName
        }
      : DEFAULT_SONG;

  const audio = new Audio();
  audio.preload = "auto";
  applyPersistedAudioPreferences(audio, currentConfig);

  const resolveSongUrlFromApi = createSongUrlResolver({
    apiBase
  });
  const resolvePlaylist = createPlaylistResolver({
    apiBase
  });

  let currentPlaylist: ResolvedPlaylist | null = null;
  let configSaveChain = Promise.resolve(currentConfig);
  let lastPersistedSongId = currentConfig.player.lastSong?.songId ?? "";
  let currentPlaylistId = currentConfig.player.currentPlaylistId ?? currentConfig.player.playlistId;
  let currentUiState: UiLayoutState = "compact";
  let volumeSaveHandle: number | null = null;
  const songArtistsById = new Map<string, string>();
  const appWindow = currentWindow;

  if (currentConfig.player.lastSong?.artist) {
    songArtistsById.set(
      currentConfig.player.lastSong.songId,
      currentConfig.player.lastSong.artist
    );
  }

  function queueConfigPatch(
    patch: UserConfigPatch,
    reason: string,
    notifyMessage?: string
  ): Promise<UserConfig> {
    configSaveChain = configSaveChain
      .then(async () => {
        currentConfig = await updateUserConfig(patch);
        return currentConfig;
      })
      .catch(async (error) => {
        const detail = getErrorMessage(error, "未知错误");

        if (notifyMessage) {
          notifier.warn(notifyMessage);
        }

        await logger.error("配置保存失败", {
          detail,
          reason
        });

        return currentConfig;
      });

    return configSaveChain;
  }

  function applyVisualSettings(config: UserConfig): void {
    const scaledWidth = Math.round(DEFAULT_PET_FRAME_WIDTH * config.pet.petSize);
    const scaledHeight = Math.round(DEFAULT_PET_FRAME_HEIGHT * config.pet.petSize);

    refs.shell.style.setProperty("--pet-opacity", String(config.window.opacity));
    refs.shell.style.setProperty("--pet-size", String(config.pet.petSize));
    refs.shell.style.setProperty("--pet-scaled-width", `${scaledWidth}px`);
    refs.shell.style.setProperty("--pet-scaled-height", `${scaledHeight}px`);
    refs.shell.style.setProperty("--settings-panel-top", `${scaledHeight + 12}px`);
    resizeWindowForUiState(currentUiState);
  }

  function syncSettingsControls(): void {
    refs.settingAlwaysOnTop.checked = currentConfig.window.alwaysOnTop;
    refs.settingOpacity.value = String(Math.round(currentConfig.window.opacity * 100));
    refs.settingPetSize.value = String(Math.round(currentConfig.pet.petSize * 100));
    refs.settingVolume.value = String(Math.round(audio.volume * 100));
    refs.settingMuted.checked = audio.muted;
    refs.settingSkin.value = currentConfig.pet.selectedSkin;
  }

  function openSettingsPanel(): void {
    setUiState("settings");
    syncSettingsControls();
    void logger.info("打开设置面板");
  }

  function closeSettingsPanel(): void {
    setUiState("compact");
  }

  function hideContextMenu(): void {
    refs.shell.dataset.contextMenuOpen = "false";
    void WebviewWindow.getByLabel(MENU_WINDOW_LABEL)
      .then((menuWindow) => menuWindow?.hide())
      .catch(() => {});
  }

  function resizeWindowForUiState(state: UiLayoutState): void {
    const size = getWindowSizeWithPetScale(state, currentConfig.pet.petSize);

    void appWindow
      .setSize(new LogicalSize(size.width, size.height))
      .catch(async (error) => {
        await logger.warn("窗口尺寸调整失败", {
          detail: getErrorMessage(error, "未知错误"),
          state
        });
      });
  }

  function setUiState(state: UiLayoutState): void {
    currentUiState = state;
    refs.shell.dataset.uiState = state;
    refs.settingsPanel.hidden = state !== "settings";
    hideContextMenu();
    resizeWindowForUiState(state);
  }

  function openContextMenu(position: { x: number; y: number }): void {
    refs.shell.dataset.contextMenuOpen = "true";
    void showMenuWindow(appWindow, position)
      .catch(async (error) => {
        await logger.error("UI 操作异常", {
          action: "open-context-menu-window",
          detail: getErrorMessage(error, "未知错误")
        });
        refs.shell.dataset.contextMenuOpen = "false";
      });
    void logger.info("打开右键菜单");
  }

  function persistSettingsPatch(
    patch: UserConfigPatch,
    reason: string
  ): void {
    void queueConfigPatch(patch, reason, getConfigFallbackMessage("write"))
      .then((updatedConfig) => {
        currentConfig = updatedConfig;
        applyVisualSettings(currentConfig);
        syncSettingsControls();
        void logger.info("修改设置", { reason });
      });
  }

  function syncVolumeControls(): void {
    refs.settingVolume.value = String(Math.round(audio.volume * 100));
    refs.settingMuted.checked = audio.muted;
  }

  function getPickerPayload(kind: PickerKind): PickerWindowPayload {
    return {
      kind,
      playlists: currentConfig.player.savedPlaylists,
      currentPlaylistId,
      currentSongId: String(playbackController.getCurrentSong()?.id ?? "")
    };
  }

  function emitPickerData(kind: PickerKind): void {
    void emitTo(getPickerWindowLabel(kind), "pet-picker-data", getPickerPayload(kind));
  }

  function emitPickerFeedback(
    kind: PickerKind,
    message: string,
    state: "idle" | "loading" | "error" = "idle"
  ): void {
    void emitTo(getPickerWindowLabel(kind), "pet-picker-feedback", {
      kind,
      message,
      state
    });
  }

  function renderImportedPlaylist(playlist: ResolvedPlaylist): void {
    setCurrentPlaylistLabel(refs.currentPlaylist, playlist.name);
    emitPickerData("playlist");
    emitPickerData("song");
  }

  function restorePlaylistSummary(): void {
    const savedPlaylist = findSavedPlaylist(
      currentConfig.player.savedPlaylists,
      currentPlaylistId
    );

    setCurrentPlaylistLabel(refs.currentPlaylist, savedPlaylist?.name ?? currentConfig.player.playlistName);
    emitPickerData("playlist");
    emitPickerData("song");
  }

  async function restorePersistedPlaylist(): Promise<void> {
    currentPlaylistId = currentConfig.player.currentPlaylistId ?? currentConfig.player.playlistId;
    const savedPlaylist = findSavedPlaylist(
      currentConfig.player.savedPlaylists,
      currentPlaylistId
    );

    if (savedPlaylist) {
      const restoredPlaylist = savedPlaylistToResolvedPlaylist(savedPlaylist);

      currentPlaylist = restoredPlaylist;
      populatePlaylistSession({
        playlist: restoredPlaylist,
        artistsBySongId: songArtistsById,
        playbackController
      });
      renderImportedPlaylist(restoredPlaylist);
      await logger.info("本地歌单恢复成功", {
        playlistId: savedPlaylist.id,
        playlistName: savedPlaylist.name,
        songCount: savedPlaylist.trackCount
      });
      return;
    }

    const playlistRequest = getPersistedPlaylistRequest(currentConfig);

    if (!playlistRequest) {
      restorePlaylistSummary();
      return;
    }

    restorePlaylistSummary();
    emitPickerFeedback("playlist", "正在恢复上次歌单", "loading");

    try {
      const playlist = await resolvePlaylist(playlistRequest);

      currentPlaylist = playlist;
      populatePlaylistSession({
        playlist,
        artistsBySongId: songArtistsById,
        playbackController
      });
      const savedPlaylist = buildSavedPlaylist(playlist);
      const addResult = addSavedPlaylist(
        currentConfig.player.savedPlaylists,
        savedPlaylist
      );

      if (addResult.added) {
        currentConfig.player.savedPlaylists = addResult.playlists;
        currentConfig.player.currentPlaylistId = playlist.id;
        currentPlaylistId = playlist.id;
        void queueConfigPatch(
          {
            player: {
              currentPlaylistId,
              playlistId: playlist.id,
              playlistName: playlist.name,
              savedPlaylists: addResult.playlists
            }
          },
          "迁移上次歌单到本地歌单库",
          getConfigFallbackMessage("write")
        );
      }
      renderImportedPlaylist(playlist);
      emitPickerFeedback("playlist", "已恢复上次歌单");
      await logger.info("歌单恢复成功", {
        playlistId: playlist.id,
        playlistName: playlist.name,
        songCount: playlist.songs.length
      });
    } catch (error) {
      const detail = getErrorMessage(error, "歌单恢复失败");

      restorePlaylistSummary();
      emitPickerFeedback("playlist", "上次歌单恢复失败，请重新导入歌单。", "error");
      await logger.warn("歌单恢复失败", {
        detail,
        playlistId: playlistRequest
      });
    }
  }

  const playbackController = createPlaybackController(
    audio,
    {
      stage: refs.petStage,
      status: refs.playbackStatus,
      error: refs.playbackError
    },
    {
      resolveSongUrl: async (songId) => {
        const resolvedUrl = await resolveSongUrlFromApi(songId);

        await logger.info("歌曲 URL 获取成功", {
          songId: String(songId),
          ...describeUrlForLog(resolvedUrl)
        });

        return resolvedUrl;
      },
      initialSong,
      onPlaybackError: ({ message, song }) => {
        const friendlyMessage = getPlaybackFriendlyMessage(new Error(message));

        notifier.error(friendlyMessage);

        void logger.error(
          /URL|请求失败|后端未返回歌曲 URL/.test(message)
            ? "歌曲 URL 获取失败"
            : "播放失败",
          {
            detail: message,
            songId: song ? String(song.id) : null,
            songName: song?.name ?? null
          }
        );
      },
      onStateChange: ({ currentSong }) => {
        setCurrentSongLabel(refs.currentSong, currentSong);

        if (currentPlaylist) {
          renderImportedPlaylist(currentPlaylist);
        }

        if (!currentSong) {
          return;
        }

        const currentSongId = String(currentSong.id);

        if (currentSongId === lastPersistedSongId) {
          return;
        }

        lastPersistedSongId = currentSongId;
        void queueConfigPatch(
          {
            player: {
              lastSong: buildPersistedSong(currentSong, songArtistsById, audio)
            }
          },
          "保存上次播放歌曲",
          getConfigFallbackMessage("write")
        );
      }
    }
  );

  setCurrentSongLabel(refs.currentSong, playbackController.getCurrentSong());
  void restorePersistedPlaylist();
  applyVisualSettings(currentConfig);
  syncVolumeControls();
  syncSettingsControls();
  setUiState("compact");

  if (audio.muted) {
    refs.playbackStatus.textContent = "已静音";
  }

  audio.addEventListener("play", () => {
    const currentSong = playbackController.getCurrentSong();

    void logger.info("播放成功", {
      songId: currentSong ? String(currentSong.id) : null,
      songName: currentSong?.name ?? null
    });
  });

  audio.addEventListener("volumechange", () => {
    syncVolumeControls();

    if (volumeSaveHandle) {
      clearTimeout(volumeSaveHandle);
    }

    volumeSaveHandle = window.setTimeout(() => {
      void queueConfigPatch(
        {
          player: {
            muted: audio.muted,
            volume: roundVolume(audio.volume)
          }
        },
        "保存音量或静音状态",
        getConfigFallbackMessage("write")
      );
    }, 120);
  });

  async function importPlaylistFromInput(
    rawInput: string,
    source: "picker"
  ): Promise<void> {
    let playlistId: string;

    try {
      playlistId = parsePlaylistId(rawInput);
    } catch (error) {
      const friendlyMessage = getPlaylistFriendlyMessage(error);

      notifier.error(friendlyMessage);
      emitPickerFeedback("playlist", friendlyMessage, "error");
      await logger.warn("歌单导入失败", {
        source,
        detail: getErrorMessage(error, "无法解析歌单 ID")
      });
      return;
    }

    if (findSavedPlaylist(currentConfig.player.savedPlaylists, playlistId)) {
      const duplicateMessage = "这个歌单已经保存过了，不需要重复导入。";

      notifier.warn(duplicateMessage);
      emitPickerFeedback("playlist", duplicateMessage, "error");
      await logger.warn("歌单重复导入", {
        source,
        playlistId
      });
      return;
    }

    emitPickerFeedback("playlist", "正在导入歌单", "loading");

    try {
      const playlist = await resolvePlaylist(playlistId);
      const savedPlaylist = buildSavedPlaylist(playlist);
      const addResult = addSavedPlaylist(
        currentConfig.player.savedPlaylists,
        savedPlaylist
      );

      if (!addResult.added) {
        const duplicateMessage = "这个歌单已经保存过了，不需要重复导入。";

        notifier.warn(duplicateMessage);
        emitPickerFeedback("playlist", duplicateMessage, "error");
        return;
      }

      currentConfig.player.savedPlaylists = addResult.playlists;
      emitPickerData("playlist");
      emitPickerFeedback("playlist", "歌单已保存到本地");
      notifier.info(`歌单已导入：${playlist.name}`);
      await logger.info("歌单导入成功", {
        source,
        playlistId: playlist.id,
        playlistName: playlist.name,
        songCount: playlist.songs.length
      });
      void queueConfigPatch(
        {
          player: {
            savedPlaylists: addResult.playlists
          }
        },
        "保存本地歌单库",
        getConfigFallbackMessage("write")
      );
    } catch (error) {
      const detail = getErrorMessage(error, "歌单导入失败");
      const friendlyMessage = getPlaylistFriendlyMessage(error);

      notifier.error(friendlyMessage);
      emitPickerFeedback("playlist", friendlyMessage, "error");
      await logger.error("歌单导入失败", {
        source,
        detail
      });

      emitPickerData("playlist");
    }
  }

  async function playCurrentPlaylistFromIndex(startIndex: number): Promise<boolean> {
    if (!currentPlaylist || currentPlaylist.songs.length === 0) {
      return false;
    }

    for (let index = startIndex; index < currentPlaylist.songs.length; index += 1) {
      const didStartPlayback = await playbackController.playSongAtIndex(index);

      if (didStartPlayback) {
        emitPickerData("song");
        return true;
      }

      await logger.warn("歌曲不可播放，尝试下一首", {
        playlistId: currentPlaylist.id,
        songId: String(currentPlaylist.songs[index].id),
        songName: currentPlaylist.songs[index].name
      });
    }

    return false;
  }

  async function playSavedPlaylistById(
    playlistId: string,
    source: "picker"
  ): Promise<void> {
    const savedPlaylist = findSavedPlaylist(
      currentConfig.player.savedPlaylists,
      playlistId
    );

    if (!savedPlaylist) {
      const message = "没有找到这个歌单，请重新导入。";

      notifier.warn(message);
      emitPickerFeedback("playlist", message, "error");
      return;
    }

    try {
      const playlist = savedPlaylistToResolvedPlaylist(savedPlaylist);

      currentPlaylist = playlist;
      currentPlaylistId = savedPlaylist.id;
      currentConfig.player.currentPlaylistId = savedPlaylist.id;
      currentConfig.player.playlistId = savedPlaylist.id;
      currentConfig.player.playlistName = savedPlaylist.name;
      populatePlaylistSession({
        playlist,
        artistsBySongId: songArtistsById,
        playbackController
      });
      renderImportedPlaylist(playlist);
      await logger.info("选择歌单播放", {
        source,
        playlistId: savedPlaylist.id,
        playlistName: savedPlaylist.name,
        songCount: savedPlaylist.trackCount
      });
      void queueConfigPatch(
        {
          player: {
            currentPlaylistId: savedPlaylist.id,
            playlistId: savedPlaylist.id,
            playlistName: savedPlaylist.name
          }
        },
        "保存当前播放歌单",
        getConfigFallbackMessage("write")
      );
      const didStartPlayback = await playCurrentPlaylistFromIndex(0);

      if (didStartPlayback) {
        emitPickerFeedback("playlist", `已切换到：${savedPlaylist.name}`);
        return;
      }

      const message = "这个歌单暂时没有可播放的歌曲。";

      notifier.error(message);
      emitPickerFeedback("playlist", message, "error");
    } catch (error) {
      const detail = getErrorMessage(error, "歌单歌曲播放失败");
      const friendlyMessage = getPlaybackFriendlyMessage(error);

      notifier.error(friendlyMessage);
      emitPickerFeedback("playlist", friendlyMessage, "error");
      await logger.error("播放失败", {
        source,
        detail,
        playlistId,
        playlistName: savedPlaylist.name
      });
    }
  }

  async function playCurrentPlaylistSongById(songId: number): Promise<void> {
    if (!currentPlaylist) {
      const savedPlaylist = findSavedPlaylist(
        currentConfig.player.savedPlaylists,
        currentPlaylistId
      );

      if (savedPlaylist) {
        currentPlaylist = savedPlaylistToResolvedPlaylist(savedPlaylist);
        populatePlaylistSession({
          playlist: currentPlaylist,
          artistsBySongId: songArtistsById,
          playbackController
        });
      }
    }

    if (!currentPlaylist) {
      const message = "请先选择一个歌单。";

      notifier.warn(message);
      emitPickerFeedback("song", message, "error");
      return;
    }

    const songIndex = currentPlaylist.songs.findIndex((song) => song.id === songId);

    if (songIndex < 0) {
      const message = "没有找到这首歌。";

      notifier.warn(message);
      emitPickerFeedback("song", message, "error");
      return;
    }

    try {
      await logger.info("切换歌曲", {
        songId: String(songId),
        songName: currentPlaylist.songs[songIndex].name,
        playlistId: currentPlaylist.id
      });
      const didStartPlayback = await playbackController.playSongAtIndex(songIndex);

      if (didStartPlayback) {
        emitPickerData("song");
        return;
      }

      emitPickerFeedback("song", "这首歌暂时无法播放。", "error");
    } catch (error) {
      const detail = getErrorMessage(error, "歌单歌曲播放失败");
      const friendlyMessage = getPlaybackFriendlyMessage(error);

      notifier.error(friendlyMessage);
      emitPickerFeedback("song", friendlyMessage, "error");
      await logger.error("播放失败", {
        detail,
        songId: String(songId),
        playlistId: currentPlaylist.id
      });
    }
  }

  refs.settingsClose.addEventListener("click", () => {
    closeSettingsPanel();
  });

  refs.settingAlwaysOnTop.addEventListener("change", async () => {
    const alwaysOnTop = refs.settingAlwaysOnTop.checked;

    currentConfig.window.alwaysOnTop = alwaysOnTop;
    applyVisualSettings(currentConfig);

    try {
      await applyWindowPreferences(alwaysOnTop);
      persistSettingsPatch({ window: { alwaysOnTop } }, "窗口置顶");
    } catch (error) {
      await logger.error("UI 操作异常", {
        action: "apply-always-on-top",
        detail: getErrorMessage(error, "未知错误")
      });
      notifier.error("窗口置顶设置失败，请稍后重试。");
    }
  });

  refs.settingOpacity.addEventListener("input", () => {
    const opacity = roundVolume(Number(refs.settingOpacity.value) / 100);

    currentConfig.window.opacity = opacity;
    applyVisualSettings(currentConfig);
  });

  refs.settingOpacity.addEventListener("change", () => {
    persistSettingsPatch(
      { window: { opacity: roundVolume(Number(refs.settingOpacity.value) / 100) } },
      "桌宠透明度"
    );
  });

  refs.settingPetSize.addEventListener("input", () => {
    const petSize = roundVolume(Number(refs.settingPetSize.value) / 100);

    currentConfig.pet.petSize = petSize;
    applyVisualSettings(currentConfig);
  });

  refs.settingPetSize.addEventListener("change", () => {
    persistSettingsPatch(
      { pet: { petSize: roundVolume(Number(refs.settingPetSize.value) / 100) } },
      "桌宠大小"
    );
  });

  refs.settingVolume.addEventListener("input", () => {
    audio.volume = Number(refs.settingVolume.value) / 100;
  });

  refs.settingMuted.addEventListener("change", () => {
    audio.muted = refs.settingMuted.checked;
  });

  refs.settingSkin.addEventListener("change", () => {
    persistSettingsPatch(
      { pet: { selectedSkin: refs.settingSkin.value } },
      "当前皮肤"
    );
  });

  async function openLogs(): Promise<void> {
    try {
      await logger.info("打开日志目录");
      await openLogDirectory();
    } catch (error) {
      await logger.error("UI 操作异常", {
        action: "open-log-directory",
        detail: getErrorMessage(error, "未知错误")
      });
      notifier.error("日志目录打开失败。");
    }
  }

  async function openConfig(): Promise<void> {
    try {
      await logger.info("打开配置目录");
      await openConfigDirectory();
    } catch (error) {
      await logger.error("UI 操作异常", {
        action: "open-config-directory",
        detail: getErrorMessage(error, "未知错误")
      });
      notifier.error("配置目录打开失败。");
    }
  }

  refs.openLogDir.addEventListener("click", () => {
    void openLogs();
  });

  refs.openConfigDir.addEventListener("click", () => {
    void openConfig();
  });

  refs.resetSettings.addEventListener("click", async () => {
    try {
      currentConfig = await resetUserConfig();
      applyPersistedAudioPreferences(audio, currentConfig);
      await applyWindowPreferences(currentConfig.window.alwaysOnTop);
      applyVisualSettings(currentConfig);
      syncVolumeControls();
      syncSettingsControls();
      await logger.info("恢复默认设置");
      notifier.info("已恢复默认设置。");
    } catch (error) {
      await logger.error("UI 操作异常", {
        action: "reset-settings",
        detail: getErrorMessage(error, "未知错误")
      });
      notifier.error("恢复默认设置失败。");
    }
  });

  await listen<{ kind?: PickerKind; label?: string }>("pet-picker-ready", async (event) => {
    const kind = event.payload.kind;

    if (kind !== "playlist" && kind !== "song") {
      return;
    }

    emitPickerData(kind);
  });

  await listen<PickerActionPayload>("pet-picker-action", async (event) => {
    const { kind, action } = event.payload;

    if (action === "close") {
      if (kind === "playlist" || kind === "song") {
        await hideFloatingWindowByLabel(getPickerWindowLabel(kind));
      }
      return;
    }

    if (action === "back") {
      await logger.info("选择器返回上级菜单", {
        kind: kind ?? "unknown"
      });
      await showMenuWindow(appWindow, {
        x: 16,
        y: 16
      });
      return;
    }

    if (kind === "playlist" && action === "import-playlist") {
      await importPlaylistFromInput(event.payload.rawInput ?? "", "picker");
      return;
    }

    if (kind === "playlist" && action === "play-playlist") {
      await playSavedPlaylistById(event.payload.playlistId ?? "", "picker");
      return;
    }

    if (kind === "playlist" && action === "delete-playlist") {
      const playlistId = event.payload.playlistId ?? "";
      const savedPlaylist = findSavedPlaylist(
        currentConfig.player.savedPlaylists,
        playlistId
      );

      if (!savedPlaylist) {
        emitPickerFeedback("playlist", "没有找到这个歌单，请重新导入。", "error");
        return;
      }

      const shouldDelete = window.confirm(
        `确定删除「${savedPlaylist.name}」吗？只会删除本地保存记录，不会删除网易云原歌单。`
      );

      if (!shouldDelete) {
        return;
      }

      const deleteResult = deleteSavedPlaylist(
        currentConfig.player.savedPlaylists,
        playlistId,
        currentPlaylistId
      );
      const deletedCurrentPlaylist = currentPlaylistId === playlistId;

      currentConfig.player.savedPlaylists = deleteResult.playlists;
      currentConfig.player.currentPlaylistId = deleteResult.currentPlaylistId;
      currentPlaylistId = deleteResult.currentPlaylistId;

      if (deletedCurrentPlaylist) {
        currentPlaylist = null;
        currentConfig.player.playlistId = null;
        currentConfig.player.playlistName = null;
        currentConfig.player.lastSong = null;
        lastPersistedSongId = "";
        playbackController.clearPlayback();
        setCurrentSongLabel(refs.currentSong, null);
        setCurrentPlaylistLabel(refs.currentPlaylist, null);
      }

      emitPickerData("playlist");
      emitPickerData("song");
      await queueConfigPatch(
        {
          player: {
            currentPlaylistId,
            playlistId: deletedCurrentPlaylist ? null : currentConfig.player.playlistId,
            playlistName: deletedCurrentPlaylist ? null : currentConfig.player.playlistName,
            lastSong: deletedCurrentPlaylist ? null : currentConfig.player.lastSong,
            savedPlaylists: deleteResult.playlists
          }
        },
        "删除本地歌单",
        getConfigFallbackMessage("write")
      );
      notifier.info("已删除本地歌单记录。");
      emitPickerFeedback("playlist", "已删除本地歌单记录。");
      await logger.info("删除本地歌单", {
        playlistId,
        deletedCurrentPlaylist
      });
      return;
    }

    if (kind === "song" && action === "play-song") {
      await playCurrentPlaylistSongById(Number(event.payload.songId));
      return;
    }
  });

  await listen<{ action?: ContextMenuAction }>("pet-menu-action", async (event) => {
    const action = event.payload.action;

    if (action === "toggle-playback") {
      await logger.info("点击播放控制", { action: "menu-toggle" });
      await playbackController.togglePlayback();
      return;
    }

    if (action === "switch-playlist") {
      await logger.info("打开切换歌单窗口");
      await showPickerWindow(appWindow, "playlist");
      emitPickerFeedback("playlist", "", "idle");
      emitPickerData("playlist");
      return;
    }

    if (action === "switch-song") {
      await logger.info("打开切换歌曲窗口");
      await showPickerWindow(appWindow, "song");
      emitPickerFeedback("song", "", "idle");
      emitPickerData("song");
      return;
    }

    if (action === "open-settings") {
      openSettingsPanel();
      return;
    }

    if (action === "toggle-always-on-top") {
      refs.settingAlwaysOnTop.checked = !currentConfig.window.alwaysOnTop;
      refs.settingAlwaysOnTop.dispatchEvent(new Event("change"));
      return;
    }

    if (action === "open-log-dir") {
      await openLogs();
      return;
    }

    if (action === "exit") {
      await logger.info("右键菜单退出");
      await appWindow.close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setUiState("compact");
    }
  });

  bindPetWindowInteractions(
    refs.petSurface,
    {
      startDragging: async () => {
        await appWindow.startDragging();
      },
      togglePlayback: async () => {
        await logger.info("点击播放控制", { action: "pet-toggle" });
        await playbackController.togglePlayback();
      },
      playNext: async () => {
        await logger.info("点击播放控制", { action: "left-double-next" });
        await playbackController.playNext();
      },
      playPrevious: async () => {
        await logger.info("点击播放控制", { action: "right-double-previous" });
        await playbackController.playPrevious();
      },
      changeVolume: (delta) => {
        audio.volume = Math.max(0, Math.min(1, roundVolume(audio.volume + delta)));
      },
      openContextMenu,
      setDragging: (isDragging) => {
        refs.petStage.dataset.dragging = String(isDragging);
        refs.petStage.dataset.animation = isDragging
          ? "dragging"
          : refs.petStage.dataset.playbackState ?? "paused";
      }
    },
    window
  );
}

if (currentWindow.label === MENU_WINDOW_LABEL) {
  initializeMenuWindow();
} else if (currentWindow.label === PLAYLIST_PICKER_WINDOW_LABEL) {
  initializePlaylistPickerWindow();
} else if (currentWindow.label === SONG_PICKER_WINDOW_LABEL) {
  initializeSongPickerWindow();
} else {
  appRoot.innerHTML = renderApp();
  void bootstrap().catch((error) => {
    const detail = getErrorMessage(error, "前端初始化失败");
    console.error(detail);
  });
}
