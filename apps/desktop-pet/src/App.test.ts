import { describe, expect, it } from "vitest";
import { renderApp } from "./App";

describe("renderApp", () => {
  it("renders the playlist import controls, queue actions, and current-song hooks", () => {
    const markup = renderApp();

    expect(markup).toContain("data-pet-surface");
    expect(markup).toContain('data-playback-state="paused"');
    expect(markup).toContain("已暂停");
    expect(markup).toContain("data-playback-error");
    expect(markup).toContain("data-current-song");
    expect(markup).toContain("data-queue-previous");
    expect(markup).toContain("data-queue-next");
    expect(markup).toContain("data-playlist-input");
    expect(markup).toContain("data-playlist-submit");
    expect(markup).toContain("data-playlist-list");
  });
});
