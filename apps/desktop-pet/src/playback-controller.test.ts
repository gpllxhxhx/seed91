import { describe, expect, it } from "vitest";
import { createPlaybackController } from "./playback-controller";

class FakeAudio extends EventTarget {
  paused = true;
  currentTime = 0;
  src = "";
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
  it("requests the song url, assigns audio.src, and updates the UI to playing", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const resolveSongUrl = async () => "https://example.com/song.mp3";
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl
    });

    await controller.togglePlayback();

    expect(audio.src).toBe("https://example.com/song.mp3");
    expect(refs.stage.dataset.playbackState).toBe("playing");
    expect(refs.status.textContent).toBe("播放中");
    expect(refs.error.hidden).toBe(true);
  });

  it("pauses, then resumes from the cached url without requesting again", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    let resolveCount = 0;
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async () => {
        resolveCount += 1;
        return "https://example.com/song.mp3";
      }
    });

    await controller.togglePlayback();
    await controller.togglePlayback();
    await controller.togglePlayback();

    expect(resolveCount).toBe(1);
    expect(refs.stage.dataset.playbackState).toBe("playing");
    expect(audio.src).toBe("https://example.com/song.mp3");
    expect(refs.status.textContent).toBe("播放中");
  });

  it("shows a request error and stays paused when fetching the song url fails", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async () => {
        throw new Error("请求失败：HTTP 404");
      }
    });

    const pendingToggle = controller.togglePlayback();

    expect(refs.stage.dataset.playbackState).toBe("loading");
    expect(refs.status.textContent).toBe("正在请求歌曲");

    await pendingToggle;

    expect(refs.error.textContent).toBe("请求失败：HTTP 404");
    expect(refs.stage.dataset.playbackState).toBe("paused");
    expect(refs.status.textContent).toBe("已暂停");
    expect(refs.error.hidden).toBe(false);
  });

  it("shows an invalid-url error when the backend returns a non-http url", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async () => "ftp://example.com/song.mp3"
    });

    await controller.togglePlayback();

    expect(refs.error.textContent).toBe("后端返回的歌曲 URL 无效");
    expect(refs.stage.dataset.playbackState).toBe("paused");
    expect(refs.status.textContent).toBe("已暂停");
    expect(refs.error.hidden).toBe(false);
  });

  it("shows a playback error when play() rejects", async () => {
    const audio = new FakeAudio(true);
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async () => "https://example.com/song.mp3"
    });

    await controller.togglePlayback();

    expect(refs.error.textContent).toContain("播放失败");
    expect(refs.stage.dataset.playbackState).toBe("paused");
    expect(refs.status.textContent).toBe("已暂停");
    expect(refs.error.hidden).toBe(false);
  });
});
