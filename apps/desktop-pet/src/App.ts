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
        <p class="current-song" data-current-song>当前歌曲：默认测试歌曲</p>
        <p class="playback-status" data-playback-status>已暂停</p>
        <p class="playback-error" data-playback-error hidden></p>
        <section class="playlist-panel" aria-label="Playlist import panel">
          <div class="queue-controls" aria-label="Playlist queue controls">
            <button
              type="button"
              class="queue-button"
              data-queue-previous
            >
              上一首
            </button>
            <button
              type="button"
              class="queue-button"
              data-queue-next
            >
              下一首
            </button>
          </div>
          <form class="playlist-form" data-playlist-form>
            <label class="playlist-label" for="playlist-input">歌单导入</label>
            <div class="playlist-form-row">
              <input
                id="playlist-input"
                class="playlist-input"
                data-playlist-input
                type="text"
                placeholder="输入歌单 ID 或链接"
                autocomplete="off"
              />
              <button
                type="submit"
                class="playlist-submit"
                data-playlist-submit
              >
                导入
              </button>
            </div>
          </form>
          <p class="playlist-feedback" data-playlist-feedback hidden></p>
          <h2 class="playlist-title" data-playlist-title>未导入歌单</h2>
          <div class="playlist-list" data-playlist-list></div>
        </section>
      </section>
    </main>
  `.trim();
}
