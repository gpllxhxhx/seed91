import defaultSkinManifest from "./assets/skins/default/manifest.json";
import defaultSpriteSheetUrl from "./assets/skins/default/sprite-sheet.svg";

type SkinManifest = {
  assets: {
    frameWidth: number;
    frameHeight: number;
  };
};

const defaultSkin = defaultSkinManifest as SkinManifest;

function getDefaultSkinStyle(): string {
  const frameWidth = defaultSkin.assets.frameWidth;
  const frameHeight = defaultSkin.assets.frameHeight;
  const frameCount = 8;

  return [
    `--pet-frame-width: ${frameWidth}px`,
    `--pet-frame-height: ${frameHeight}px`,
    `--pet-sheet-width: ${frameWidth * frameCount}px`,
    `--pet-frame-1-x: -${frameWidth}px`,
    `--pet-frame-2-x: -${frameWidth * 2}px`,
    `--pet-frame-3-x: -${frameWidth * 3}px`,
    `--pet-frame-4-x: -${frameWidth * 4}px`,
    `--pet-frame-5-x: -${frameWidth * 5}px`,
    `--pet-frame-6-x: -${frameWidth * 6}px`,
    `--pet-frame-7-x: -${frameWidth * 7}px`
  ].join("; ");
}

export function renderApp(): string {
  return `
    <main class="pet-shell" data-ui-state="compact" aria-label="Desktop pet shell">
      <section
        class="notification-stack"
        data-notification-stack
        aria-live="polite"
        aria-label="Runtime notifications"
      ></section>
      <section
        class="pet-stage"
        data-playback-state="paused"
        data-animation="paused"
        style="${getDefaultSkinStyle()}"
      >
        <div class="pet-avatar" aria-hidden="true">
          <span class="pet-shadow"></span>
          <button
            type="button"
            class="pet-surface"
            data-pet-surface
            aria-label="Desktop pet"
          >
            <span class="pet-sprite pet-sprite-viewport" data-pet-sprite>
              <img
                src="${defaultSpriteSheetUrl}"
                alt=""
                class="pet-sprite-image"
                data-pet-sprite-image
                draggable="false"
              />
            </span>
          </button>
        </div>
        <p class="current-song" data-current-song>当前歌曲：默认测试歌曲</p>
        <p class="current-playlist" data-current-playlist>当前歌单：未选择</p>
        <p class="playback-status" data-playback-status>已暂停</p>
        <p class="playback-error" data-playback-error hidden></p>
      </section>
      <section
        class="settings-panel"
        data-settings-panel
        aria-label="设置面板"
        hidden
      >
        <div class="settings-card">
          <header class="settings-header">
            <div>
              <p class="settings-eyebrow">Music Pet</p>
              <h2>桌宠设置</h2>
            </div>
            <button type="button" class="icon-button" data-settings-close aria-label="关闭设置">
              ×
            </button>
          </header>
          <div class="settings-grid">
            <label class="setting-row setting-row-inline">
              <span>窗口置顶</span>
              <input data-setting-always-on-top type="checkbox" />
            </label>
            <label class="setting-row">
              <span>透明度</span>
              <input data-setting-opacity type="range" min="20" max="100" step="5" value="100" />
            </label>
            <label class="setting-row">
              <span>桌宠大小</span>
              <input data-setting-pet-size type="range" min="50" max="160" step="5" value="100" />
            </label>
            <label class="setting-row">
              <span>音量</span>
              <input data-setting-volume type="range" min="0" max="100" step="1" value="70" />
            </label>
            <label class="setting-row setting-row-inline">
              <span>静音</span>
              <input data-setting-muted type="checkbox" />
            </label>
            <label class="setting-row">
              <span>当前皮肤</span>
              <select data-setting-skin>
                <option value="default">default</option>
              </select>
            </label>
          </div>
          <div class="settings-actions">
            <button type="button" data-open-log-dir>打开日志目录（排查问题）</button>
            <button type="button" data-open-config-dir>打开配置目录</button>
            <button type="button" class="danger-soft" data-reset-settings>恢复默认设置</button>
          </div>
          <p class="settings-note">提示：皮肤市场暂未开放，目前仅支持 default。</p>
        </div>
      </section>
    </main>
  `.trim();
}

export function renderContextMenuApp(): string {
  return `
    <main class="menu-shell" aria-label="桌宠菜单">
      <menu class="context-menu context-menu-window" data-context-menu>
        <button type="button" data-context-playback>播放 / 暂停</button>
        <button type="button" data-context-switch-playlist>切换歌单</button>
        <button type="button" data-context-switch-song>切换歌曲</button>
        <button type="button" data-context-settings>设置</button>
        <button type="button" data-context-always-on-top>置顶窗口</button>
        <button type="button" data-context-open-log-dir>打开日志目录</button>
        <button type="button" class="danger-soft" data-context-exit>退出</button>
      </menu>
    </main>
  `.trim();
}

export function renderPlaylistPickerApp(): string {
  return `
    <main class="picker-shell" aria-label="切换歌单">
      <section class="picker-card playlist-picker-card">
        <header class="picker-header">
          <div>
            <p class="picker-eyebrow">Music Pet</p>
            <h1>切换歌单</h1>
          </div>
          <div class="picker-header-actions">
            <button type="button" class="picker-back-button" data-picker-back>返回上级</button>
            <button type="button" class="icon-button" data-picker-close aria-label="关闭">×</button>
          </div>
        </header>
        <form class="picker-import-form" data-picker-import-form>
          <input
            class="picker-input"
            data-picker-import-input
            type="text"
            placeholder="粘贴网易云歌单链接或 ID"
            autocomplete="off"
          />
          <button type="submit" class="picker-primary-button" data-picker-import-submit>
            导入歌单链接
          </button>
        </form>
        <p class="picker-feedback" data-picker-feedback hidden></p>
        <div class="picker-playlist-grid" data-picker-playlist-grid></div>
      </section>
    </main>
  `.trim();
}

export function renderSongPickerApp(): string {
  return `
    <main class="picker-shell" aria-label="切换歌曲">
      <section class="picker-card song-picker-card">
        <header class="picker-header">
          <div>
            <p class="picker-eyebrow">Music Pet</p>
            <h1>切换歌曲</h1>
          </div>
          <div class="picker-header-actions">
            <button type="button" class="picker-back-button" data-picker-back>返回上级</button>
            <button type="button" class="icon-button" data-picker-close aria-label="关闭">×</button>
          </div>
        </header>
        <div class="picker-now-playing" aria-label="当前播放信息">
          <p data-picker-current-playlist>当前歌单：未选择</p>
          <p data-picker-current-song>当前歌曲：未播放</p>
        </div>
        <button type="button" class="picker-primary-button" data-locate-current-song>
          定位到正在播放歌曲
        </button>
        <p class="picker-feedback" data-picker-feedback hidden></p>
        <div class="picker-song-list" data-picker-song-list></div>
      </section>
    </main>
  `.trim();
}
