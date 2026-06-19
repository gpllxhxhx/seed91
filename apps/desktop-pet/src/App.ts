import petPlaceholderUrl from "./assets/pet-placeholder.svg";

export function renderApp(): string {
  return `
    <main class="pet-shell" aria-label="Desktop pet shell">
      <section class="pet-stage" data-playback-state="paused">
        <button
          type="button"
          class="pet-surface"
          data-pet-surface
          aria-label="Desktop pet"
        >
          <img
            src="${petPlaceholderUrl}"
            alt="Desktop pet placeholder"
            class="pet-image"
          />
        </button>
        <p class="playback-status" data-playback-status>已暂停</p>
        <p class="playback-error" data-playback-error hidden></p>
      </section>
    </main>
  `.trim();
}
