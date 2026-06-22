import { describe, expect, it } from "vitest";
import {
  renderApp,
  renderContextMenuApp,
  renderPlaylistPickerApp,
  renderSongPickerApp
} from "./App";

describe("renderApp", () => {
  it("renders a pet-first shell without previous or next interaction controls", () => {
    const markup = renderApp();

    expect(markup).toContain("data-pet-surface");
    expect(markup).toContain('data-ui-state="compact"');
    expect(markup).toContain("data-pet-sprite");
    expect(markup).toContain("data-pet-sprite-image");
    expect(markup).toContain("pet-sprite-viewport");
    expect(markup).toContain('data-playback-state="paused"');
    expect(markup).toContain('data-animation="paused"');
    expect(markup).toContain("已暂停");
    expect(markup).toContain("data-playback-error");
    expect(markup).toContain("data-current-song");
    expect(markup).not.toContain("歌单小窝");
    expect(markup).not.toContain("data-playlist-close");
    expect(markup).not.toContain("data-playlist-input");
    expect(markup).not.toContain("data-playlist-panel");
    expect(markup).not.toContain("data-playlist-import-toggle");
    expect(markup).not.toContain("data-playlist-submit");
    expect(markup).not.toContain("data-playlist-list");
    expect(markup).not.toContain("data-playlist-feedback");
    expect(markup).toContain("data-notification-stack");
    expect(markup).toContain("data-settings-panel");
    expect(markup).toContain("data-setting-always-on-top");
    expect(markup).toContain("data-setting-opacity");
    expect(markup).toContain("data-setting-pet-size");
    expect(markup).toContain("data-open-log-dir");
    expect(markup).toContain("打开日志目录（排查问题）");
    expect(markup).toContain("data-open-config-dir");
    expect(markup).toContain("data-reset-settings");
    expect(markup).toContain("sprite-sheet.svg");
    expect(markup).not.toContain("pet-placeholder");
    expect(markup).not.toContain("data-queue-previous");
    expect(markup).not.toContain("data-queue-next");
    expect(markup).not.toContain("data-volume-range");
    expect(markup).not.toContain("data-mute-toggle");
    expect(markup).not.toContain("data-floating-controls");
    expect(markup).not.toContain("data-floating-previous");
    expect(markup).not.toContain("data-floating-next");
    expect(markup).not.toContain("data-context-menu");
    expect(markup).not.toContain("data-setting-show-controls");
  });

  it("renders the context menu markup for the dedicated menu window", () => {
    const markup = renderContextMenuApp();

    expect(markup).toContain("menu-shell");
    expect(markup).toContain("data-context-menu");
    expect(markup).toContain("data-context-playback");
    expect(markup).toContain("data-context-switch-playlist");
    expect(markup).toContain("data-context-switch-song");
    expect(markup).toContain("data-context-settings");
    expect(markup).toContain("data-context-always-on-top");
    expect(markup).toContain("data-context-open-log-dir");
    expect(markup).toContain("data-context-exit");
    expect(markup).not.toContain("data-context-import-playlist");
    expect(markup).not.toContain("歌单管理");
    expect(markup).not.toContain("data-context-previous");
    expect(markup).not.toContain("data-context-next");
  });

  it("renders dedicated playlist and song picker windows", () => {
    const playlistMarkup = renderPlaylistPickerApp();
    const songMarkup = renderSongPickerApp();

    expect(playlistMarkup).toContain("picker-shell");
    expect(playlistMarkup).toContain("data-picker-import-form");
    expect(playlistMarkup).toContain("data-picker-playlist-grid");
    expect(playlistMarkup).toContain("data-picker-back");
    expect(playlistMarkup).toContain("导入歌单链接");
    expect(playlistMarkup).not.toContain("歌单小窝");
    expect(songMarkup).toContain("picker-shell");
    expect(songMarkup).toContain("data-locate-current-song");
    expect(songMarkup).toContain("data-picker-current-playlist");
    expect(songMarkup).toContain("data-picker-current-song");
    expect(songMarkup).toContain("data-picker-back");
    expect(songMarkup).toContain("data-picker-song-list");
    expect(songMarkup).toContain("定位到正在播放歌曲");
  });
});
