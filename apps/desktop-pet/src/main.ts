import "./style.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { renderApp } from "./App";
import { bindPetWindowInteractions } from "./pet-window";
import {
  createPlaybackController,
  type PlaybackSong
} from "./playback-controller";
import { createSongUrlResolver } from "./song-url-resolver";
import {
  createPlaylistResolver,
  type PlaylistSong,
  type ResolvedPlaylist
} from "./playlist-resolver";

const DEFAULT_SONG: PlaybackSong = {
  id: "1496089152",
  name: "默认测试歌曲"
};

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("App root element was not found.");
}

root.innerHTML = renderApp();

const petSurface = root.querySelector<HTMLElement>("[data-pet-surface]");
const petStage = root.querySelector<HTMLElement>("[data-playback-state]");
const playbackStatus = root.querySelector<HTMLElement>("[data-playback-status]");
const playbackError = root.querySelector<HTMLElement>("[data-playback-error]");
const currentSong = root.querySelector<HTMLElement>("[data-current-song]");
const playlistForm = root.querySelector<HTMLFormElement>("[data-playlist-form]");
const playlistInput = root.querySelector<HTMLInputElement>("[data-playlist-input]");
const playlistSubmit = root.querySelector<HTMLButtonElement>("[data-playlist-submit]");
const playlistFeedback = root.querySelector<HTMLElement>("[data-playlist-feedback]");
const playlistTitle = root.querySelector<HTMLElement>("[data-playlist-title]");
const playlistList = root.querySelector<HTMLElement>("[data-playlist-list]");

if (!petSurface) {
  throw new Error("Pet surface element was not found.");
}

if (!petStage || !playbackStatus || !playbackError) {
  throw new Error("Playback state elements were not found.");
}

if (
  !currentSong ||
  !playlistForm ||
  !playlistInput ||
  !playlistSubmit ||
  !playlistFeedback ||
  !playlistTitle ||
  !playlistList
) {
  throw new Error("Playlist panel elements were not found.");
}

const playbackStageElement = petStage;
const playbackStatusElement = playbackStatus;
const playbackErrorElement = playbackError;
const currentSongElement = currentSong;
const playlistFormElement = playlistForm;
const playlistInputElement = playlistInput;
const playlistSubmitElement = playlistSubmit;
const playlistFeedbackElement = playlistFeedback;
const playlistTitleElement = playlistTitle;
const playlistListElement = playlistList;
const testAudio = new Audio();
const apiBase = import.meta.env.VITE_MUSIC_API_BASE ?? "";
const resolveSongUrl = createSongUrlResolver({
  apiBase
});
const resolvePlaylist = createPlaylistResolver({
  apiBase
});

testAudio.preload = "auto";

const playbackController = createPlaybackController(testAudio, {
  stage: playbackStageElement,
  status: playbackStatusElement,
  error: playbackErrorElement
}, {
  resolveSongUrl,
  initialSong: DEFAULT_SONG
});

let currentPlaylist: ResolvedPlaylist | null = null;

function getCurrentSongId(): string {
  return String(playbackController.getCurrentSong()?.id ?? "");
}

function setCurrentSongLabel(song: PlaybackSong | null): void {
  currentSongElement.textContent = song
    ? `当前歌曲：${song.name}`
    : "当前歌曲：未选择";
}

function setPlaylistFeedbackMessage(
  message: string,
  state: "idle" | "loading" | "error" = "idle"
): void {
  playlistFeedbackElement.textContent = message;
  playlistFeedbackElement.hidden = !message;
  playlistFeedbackElement.dataset.state = state;
}

function renderPlaylistSongs(
  songs: PlaylistSong[],
  activeSongId: string,
  emptyMessage = "请先导入歌单"
): void {
  if (songs.length === 0) {
    playlistListElement.innerHTML = `
      <p class="playlist-empty">${emptyMessage}</p>
    `.trim();
    return;
  }

  playlistListElement.innerHTML = songs
    .map((song) => {
      const isActive = String(song.id) === activeSongId;

      return `
        <button
          type="button"
          class="playlist-song${isActive ? " is-active" : ""}"
          data-playlist-song-id="${song.id}"
          aria-label="播放 ${song.name}"
        >
          <span class="playlist-song-name">${song.name}</span>
          <span class="playlist-song-meta">${song.artists}</span>
        </button>
      `.trim();
    })
    .join("");
}

function renderImportedPlaylist(playlist: ResolvedPlaylist): void {
  playlistTitleElement.textContent = playlist.name;
  renderPlaylistSongs(playlist.songs, getCurrentSongId());
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

async function importPlaylist(): Promise<void> {
  const rawInput = playlistInputElement.value.trim();

  setPlaylistFeedbackMessage("正在导入歌单", "loading");
  playlistSubmitElement.disabled = true;

  try {
    const playlist = await resolvePlaylist(rawInput);
    currentPlaylist = playlist;
    renderImportedPlaylist(playlist);
    setPlaylistFeedbackMessage("");
  } catch (error) {
    const message = getErrorMessage(error, "歌单导入失败");
    setPlaylistFeedbackMessage(message, "error");

    if (message === "歌单为空") {
      playlistTitleElement.textContent = "未导入歌单";
      renderPlaylistSongs([], getCurrentSongId(), "歌单为空");
    } else if (!currentPlaylist) {
      playlistTitleElement.textContent = "未导入歌单";
      renderPlaylistSongs([], getCurrentSongId());
    }
  } finally {
    playlistSubmitElement.disabled = false;
  }
}

playlistFormElement.addEventListener("submit", async (event) => {
  event.preventDefault();
  await importPlaylist();
});

playlistListElement.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const songButton = target.closest<HTMLElement>("[data-playlist-song-id]");

  if (!songButton || !currentPlaylist) {
    return;
  }

  const songId = Number(songButton.dataset.playlistSongId);
  const song = currentPlaylist.songs.find((item) => item.id === songId);

  if (!song) {
    return;
  }

  await playbackController.playSong({
    id: song.id,
    name: song.name
  });

  setCurrentSongLabel(playbackController.getCurrentSong());
  renderImportedPlaylist(currentPlaylist);
});

setCurrentSongLabel(playbackController.getCurrentSong());
renderPlaylistSongs([], getCurrentSongId());

bindPetWindowInteractions(
  petSurface,
  {
    startDragging: async () => {
      await getCurrentWindow().startDragging();
    },
    closeWindow: async () => {
      await getCurrentWindow().close();
    },
    togglePlayback: async () => {
      await playbackController.togglePlayback();
    }
  },
  window
);
