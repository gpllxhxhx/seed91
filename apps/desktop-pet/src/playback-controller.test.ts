import { describe, expect, it } from "vitest";
import { createPlaybackController } from "./playback-controller";

class FakeAudio extends EventTarget {
  paused = true;
  currentTime = 0;
  shouldRejectPlay: boolean;

  constructor(shouldRejectPlay = false) {
    super();
    this.shouldRejectPlay = shouldRejectPlay;
  }

  async play(): Promise<void> {
    if (this.shouldRejectPlay) {
      throw new Error("mock play failure");
    }

    this.paused = false;
    this.dispatchEvent(new Event("play"));
  }

  pause(): void {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
}

function createPlaybackRefs() {
  return {
    stage: {
      dataset: {
        playbackState: "paused"
      }
    },
    status: {
      textContent: "已暂停"
    },
    error: {
      textContent: "",
      hidden: true
    }
  };
}

describe("createPlaybackController", () => {
  it("updates the UI to playing when audio starts", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs);

    await controller.togglePlayback();

    expect(refs.stage.dataset.playbackState).toBe("playing");
    expect(refs.status.textContent).toBe("播放中");
    expect(refs.error.hidden).toBe(true);
  });

  it("updates the UI to paused when audio is paused", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs);

    await controller.togglePlayback();
    await controller.togglePlayback();

    expect(refs.stage.dataset.playbackState).toBe("paused");
    expect(refs.status.textContent).toBe("已暂停");
  });

  it("shows an error message when play() rejects", async () => {
    const audio = new FakeAudio(true);
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs);

    await controller.togglePlayback();

    expect(refs.error.textContent).toContain("播放失败");
    expect(refs.stage.dataset.playbackState).toBe("paused");
    expect(refs.status.textContent).toBe("已暂停");
    expect(refs.error.hidden).toBe(false);
  });
});
