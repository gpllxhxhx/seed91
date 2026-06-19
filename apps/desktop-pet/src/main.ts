import "./style.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { renderApp } from "./App";
import { bindPetWindowInteractions } from "./pet-window";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("App root element was not found.");
}

root.innerHTML = renderApp();

const petSurface = root.querySelector<HTMLElement>("[data-pet-surface]");

if (!petSurface) {
  throw new Error("Pet surface element was not found.");
}

bindPetWindowInteractions(petSurface, async () => {
  await getCurrentWindow().startDragging();
}, async () => {
  await getCurrentWindow().close();
});
