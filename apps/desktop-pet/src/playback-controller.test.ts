import { describe, expect, it, vi } from "vitest";
import { createPlaybackController } from "./playback-controller";

const DEFAULT_SONG = { id: 1496089152, name: "默认测试歌曲" };

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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return {
    promise,
    resolve
  };
}

describe("createPlaybackController", () => {
  it("requests the song url, assigns audio.src, and updates the UI to playing", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const resolveSongUrl = async (songId: string | number) =>
      `https://example.com/${songId}.mp3`;
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl,
      initialSong: DEFAULT_SONG
    });

    await expect(controller.togglePlayback()).resolves.toBe(true);

    expect(audio.src).toBe("https://example.com/1496089152.mp3");
    expect(refs.stage.dataset.playbackState).toBe("playing");
    expect(refs.status.textContent).toBe("播放中");
    expect(refs.error.hidden).toBe(true);
  });

  it("reports a failed indexed playback attempt to callers", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async () => {
        throw new Error("后端未返回歌曲 URL");
      }
    });

    controller.setQueue([{ id: 101, name: "第一首" }]);

    await expect(controller.playSongAtIndex(0)).resolves.toBe(false);
    expect(audio.paused).toBe(true);
    expect(refs.error.textContent).toBe("后端未返回歌曲 URL");
  });

  it("pauses, then resumes the same current song without requesting again", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    let resolveCount = 0;
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async (songId: string | number) => {
        resolveCount += 1;
        return `https://example.com/${songId}.mp3`;
      },
      initialSong: DEFAULT_SONG
    });

    await controller.togglePlayback();
    await controller.togglePlayback();
    await controller.togglePlayback();

    expect(resolveCount).toBe(1);
    expect(refs.stage.dataset.playbackState).toBe("playing");
    expect(audio.src).toBe("https://example.com/1496089152.mp3");
    expect(refs.status.textContent).toBe("播放中");
  });

  it("shows a request error and stays paused when fetching the song url fails", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async () => {
        throw new Error("请求失败：HTTP 404");
      },
      initialSong: DEFAULT_SONG
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
      resolveSongUrl: async () => "ftp://example.com/song.mp3",
      initialSong: DEFAULT_SONG
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
    const onPlaybackError = vi.fn();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async () => "https://example.com/song.mp3",
      initialSong: DEFAULT_SONG,
      onPlaybackError
    });

    await controller.togglePlayback();

    expect(refs.error.textContent).toContain("播放失败");
    expect(refs.stage.dataset.playbackState).toBe("paused");
    expect(refs.status.textContent).toBe("已暂停");
    expect(refs.error.hidden).toBe(false);
    expect(onPlaybackError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("播放失败"),
        song: DEFAULT_SONG
      })
    );
  });

  it("switches to a clicked playlist song and starts playback", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async (songId: string | number) =>
        `https://example.com/${songId}.mp3`,
      initialSong: DEFAULT_SONG
    });

    await controller.playSong({ id: 202, name: "列表歌曲" });

    expect(audio.src).toBe("https://example.com/202.mp3");
    expect(controller.getCurrentSong()?.name).toBe("列表歌曲");
    expect(refs.stage.dataset.playbackState).toBe("playing");
    expect(refs.status.textContent).toBe("播放中");
  });

  it("plays the next song in the queue and updates the current index", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async (songId: string | number) =>
        `https://example.com/${songId}.mp3`
    });

    controller.setQueue([
      { id: 101, name: "第一首" },
      { id: 202, name: "第二首" }
    ]);

    await controller.playSongAtIndex(0);
    await controller.playNext();

    expect(controller.getCurrentSongIndex()).toBe(1);
    expect(controller.getCurrentSong()?.name).toBe("第二首");
    expect(audio.src).toBe("https://example.com/202.mp3");
  });

  it("ignores a stale song url request when the user switches songs quickly", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const firstSongUrl = createDeferred<string>();
    const secondSongUrl = createDeferred<string>();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: (songId: string | number) =>
        String(songId) === "101" ? firstSongUrl.promise : secondSongUrl.promise
    });

    controller.setQueue([
      { id: 101, name: "第一首" },
      { id: 202, name: "第二首" }
    ]);

    const firstPlayback = controller.playSongAtIndex(0);
    const secondPlayback = controller.playSongAtIndex(1);

    secondSongUrl.resolve("https://example.com/202.mp3");
    await secondPlayback;

    expect(audio.src).toBe("https://example.com/202.mp3");
    expect(controller.getCurrentSong()?.id).toBe(202);

    firstSongUrl.resolve("https://example.com/101.mp3");
    await firstPlayback;

    expect(audio.src).toBe("https://example.com/202.mp3");
    expect(controller.getCurrentSong()?.id).toBe(202);
  });

  it("plays the previous song in the queue and updates the current index", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async (songId: string | number) =>
        `https://example.com/${songId}.mp3`
    });

    controller.setQueue([
      { id: 101, name: "第一首" },
      { id: 202, name: "第二首" }
    ]);

    await controller.playSongAtIndex(1);
    await controller.playPrevious();

    expect(controller.getCurrentSongIndex()).toBe(0);
    expect(controller.getCurrentSong()?.name).toBe("第一首");
    expect(audio.src).toBe("https://example.com/101.mp3");
  });

  it("shows a boundary message when trying to go previous on the first song", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async (songId: string | number) =>
        `https://example.com/${songId}.mp3`
    });

    controller.setQueue([{ id: 101, name: "第一首" }]);
    await controller.playSongAtIndex(0);
    await controller.playPrevious();

    expect(controller.getCurrentSongIndex()).toBe(0);
    expect(refs.error.textContent).toBe("已经是第一首");
    expect(refs.error.hidden).toBe(false);
  });

  it("defaults to the first song when previous is clicked before a song is selected", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async (songId: string | number) =>
        `https://example.com/${songId}.mp3`
    });

    controller.setQueue([
      { id: 101, name: "第一首" },
      { id: 202, name: "第二首" }
    ]);

    await controller.playPrevious();

    expect(controller.getCurrentSongIndex()).toBe(0);
    expect(controller.getCurrentSong()?.name).toBe("第一首");
    expect(audio.src).toBe("https://example.com/101.mp3");
  });

  it("shows a boundary message when trying to go next on the last song", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async (songId: string | number) =>
        `https://example.com/${songId}.mp3`
    });

    controller.setQueue([{ id: 101, name: "第一首" }]);
    await controller.playSongAtIndex(0);
    await controller.playNext();

    expect(controller.getCurrentSongIndex()).toBe(0);
    expect(refs.error.textContent).toBe("已经是最后一首");
    expect(refs.error.hidden).toBe(false);
  });

  it("defaults to the first song when next is clicked before a song is selected", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async (songId: string | number) =>
        `https://example.com/${songId}.mp3`
    });

    controller.setQueue([
      { id: 101, name: "第一首" },
      { id: 202, name: "第二首" }
    ]);

    await controller.playNext();

    expect(controller.getCurrentSongIndex()).toBe(0);
    expect(controller.getCurrentSong()?.name).toBe("第一首");
    expect(audio.src).toBe("https://example.com/101.mp3");
  });

  it("automatically advances to the next queue song on ended", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const onStateChange = vi.fn();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async (songId: string | number) =>
        `https://example.com/${songId}.mp3`,
      onStateChange
    });

    controller.setQueue([
      { id: 101, name: "第一首" },
      { id: 202, name: "第二首" }
    ]);

    await controller.playSongAtIndex(0);
    audio.dispatchEvent(new Event("ended"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(controller.getCurrentSongIndex()).toBe(1);
    expect(controller.getCurrentSong()?.name).toBe("第二首");
    expect(audio.src).toBe("https://example.com/202.mp3");
    expect(onStateChange).toHaveBeenLastCalledWith({
      currentSong: { id: 202, name: "第二首" },
      currentSongIndex: 1
    });
  });

  it("shows playback ended on the final queue song without looping", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async (songId: string | number) =>
        `https://example.com/${songId}.mp3`
    });

    controller.setQueue([{ id: 101, name: "第一首" }]);

    await controller.playSongAtIndex(0);
    audio.dispatchEvent(new Event("ended"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(controller.getCurrentSongIndex()).toBe(0);
    expect(refs.stage.dataset.playbackState).toBe("paused");
    expect(refs.status.textContent).toBe("播放结束");
  });

  it("clears the current song and returns to paused state", async () => {
    const audio = new FakeAudio();
    const refs = createPlaybackRefs();
    const onStateChange = vi.fn();
    const controller = createPlaybackController(audio, refs, {
      resolveSongUrl: async (songId: string | number) =>
        `https://example.com/${songId}.mp3`,
      onStateChange
    });

    controller.setQueue([{ id: 101, name: "第一首" }]);
    await controller.playSongAtIndex(0);
    controller.clearPlayback();

    expect(audio.paused).toBe(true);
    expect(controller.getCurrentSong()).toBeNull();
    expect(controller.getCurrentSongIndex()).toBe(-1);
    expect(refs.stage.dataset.playbackState).toBe("paused");
    expect(refs.status.textContent).toBe("已暂停");
    expect(onStateChange).toHaveBeenLastCalledWith({
      currentSong: null,
      currentSongIndex: -1
    });
  });
});
