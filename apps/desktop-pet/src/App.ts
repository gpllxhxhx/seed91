import petPlaceholderUrl from "./assets/pet-placeholder.svg";

export function renderApp(): string {
  return `
    <main class="pet-shell" aria-label="Desktop pet shell">
      <button
        type="button"
        class="pet-surface"
        data-pet-surface
        data-tauri-drag-region
        aria-label="Desktop pet"
      >
        <img
          src="${petPlaceholderUrl}"
          alt="Desktop pet placeholder"
          class="pet-image"
        />
      </button>
    </main>
  `.trim();
}
