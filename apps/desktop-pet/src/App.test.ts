import { describe, expect, it } from "vitest";
import { renderApp } from "./App";

describe("renderApp", () => {
  it("renders the paused playback state label and error slot", () => {
    const markup = renderApp();

    expect(markup).toContain("data-pet-surface");
    expect(markup).toContain('data-playback-state="paused"');
    expect(markup).toContain("已暂停");
    expect(markup).toContain("data-playback-error");
  });
});
