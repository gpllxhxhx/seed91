import "./style.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { renderApp } from "./App";
import { bindPetWindowInteractions } from "./pet-window";
import { createPlaybackController } from "./playback-controller";
import { createSongUrlResolver } from "./song-url-resolver";

const TEST_SONG_ID = "1496089152";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("App root element was not found.");
}

root.innerHTML = renderApp();

const petSurface = root.querySelector<HTMLElement>("[data-pet-surface]");
const petStage = root.querySelector<HTMLElement>("[data-playback-state]");
const playbackStatus = root.querySelector<HTMLElement>("[data-playback-status]");
const playbackError = root.querySelector<HTMLElement>("[data-playback-error]");

if (!petSurface) {
  throw new Error("Pet surface element was not found.");
}

if (!petStage || !playbackStatus || !playbackError) {
  throw new Error("Playback state elements were not found.");
}

const playbackStageElement = petStage;
const playbackStatusElement = playbackStatus;
const playbackErrorElement = playbackError;
const testAudio = new Audio();
const resolveSongUrl = createSongUrlResolver({
  apiBase: import.meta.env.VITE_MUSIC_API_BASE ?? "",
  songId: TEST_SONG_ID
});

testAudio.preload = "auto";

const playbackController = createPlaybackController(testAudio, {
  stage: playbackStageElement,
  status: playbackStatusElement,
  error: playbackErrorElement
}, {
  resolveSongUrl
});

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
