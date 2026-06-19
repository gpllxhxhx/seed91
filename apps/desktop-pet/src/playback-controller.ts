type AudioLike = EventTarget & {
  paused: boolean;
  src: string;
  play: () => Promise<void>;
  pause: () => void;
};

export type PlaybackSong = {
  id: number | string;
  name: string;
};

type PlaybackRefs = {
  stage: {
    dataset: {
      playbackState?: string;
    };
  };
  status: {
    textContent: string | null;
  };
  error: {
    textContent: string | null;
    hidden: boolean;
  };
};

type PlaybackControllerOptions = {
  resolveSongUrl: (songId: string | number) => Promise<string>;
  initialSong?: PlaybackSong;
};

function setPaused(refs: PlaybackRefs): void {
  refs.stage.dataset.playbackState = "paused";
  refs.status.textContent = "已暂停";
}

function setLoading(refs: PlaybackRefs): void {
  refs.stage.dataset.playbackState = "loading";
  refs.status.textContent = "正在请求歌曲";
}

function setPlaying(refs: PlaybackRefs): void {
  refs.stage.dataset.playbackState = "playing";
  refs.status.textContent = "播放中";
}

function clearError(refs: PlaybackRefs): void {
  refs.error.textContent = "";
  refs.error.hidden = true;
}

function showError(refs: PlaybackRefs, message: string): void {
  refs.error.textContent = message;
  refs.error.hidden = false;
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function isValidSongUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

export function createPlaybackController(
  audio: AudioLike,
  refs: PlaybackRefs,
  options: PlaybackControllerOptions
) {
  let currentSong: PlaybackSong | null = options.initialSong ?? null;
  const songUrlCache = new Map<string, string>();
  let pendingSongUrl: Promise<string> | null = null;
  let pendingSongId = "";
  let isToggling = false;

  setPaused(refs);
  clearError(refs);

  audio.addEventListener("play", () => {
    clearError(refs);
    setPlaying(refs);
  });

  audio.addEventListener("pause", () => {
    setPaused(refs);
  });

  audio.addEventListener("ended", () => {
    setPaused(refs);
  });

  audio.addEventListener("error", () => {
    setPaused(refs);
    showError(refs, "播放失败：当前歌曲 URL 无法播放");
  });

  function getCurrentSongId(): string {
    if (!currentSong) {
      return "";
    }

    return String(currentSong.id);
  }

  async function ensureSongUrl(): Promise<string> {
    const currentSongId = getCurrentSongId();

    if (!currentSongId) {
      throw new Error("请先选择歌曲");
    }

    const cachedSongUrl = songUrlCache.get(currentSongId);

    if (cachedSongUrl) {
      return cachedSongUrl;
    }

    if (!pendingSongUrl || pendingSongId !== currentSongId) {
      setLoading(refs);
      clearError(refs);
      pendingSongId = currentSongId;

      pendingSongUrl = options.resolveSongUrl(currentSongId)
        .then((resolvedSongUrl) => {
          const normalizedSongUrl = resolvedSongUrl.trim();

          if (!normalizedSongUrl) {
            throw new Error("后端未返回歌曲 URL");
          }

          if (!isValidSongUrl(normalizedSongUrl)) {
            throw new Error("后端返回的歌曲 URL 无效");
          }

          songUrlCache.set(currentSongId, normalizedSongUrl);
          return normalizedSongUrl;
        })
        .finally(() => {
          pendingSongUrl = null;
          pendingSongId = "";
        });
    }

    return pendingSongUrl;
  }

  async function startPlaybackForCurrentSong(): Promise<void> {
    const songUrl = await ensureSongUrl();

    if (audio.src !== songUrl) {
      audio.src = songUrl;
    }

    try {
      await audio.play();
    } catch (error) {
      throw new Error(
        `播放失败：${getErrorMessage(error, "无法播放当前歌曲")}`
      );
    }
  }

  return {
    getCurrentSong(): PlaybackSong | null {
      return currentSong;
    },
    async playSong(song: PlaybackSong): Promise<void> {
      currentSong = song;

      if (!audio.paused) {
        audio.pause();
      }

      isToggling = true;
      clearError(refs);

      try {
        await startPlaybackForCurrentSong();
      } catch (error) {
        setPaused(refs);
        showError(refs, getErrorMessage(error, "播放失败：无法播放当前歌曲"));
      } finally {
        isToggling = false;
      }
    },
    async togglePlayback(): Promise<void> {
      if (isToggling) {
        return;
      }

      if (audio.paused) {
        isToggling = true;
        clearError(refs);

        try {
          await startPlaybackForCurrentSong();
        } catch (error) {
          setPaused(refs);
          showError(refs, getErrorMessage(error, "播放失败：无法播放当前歌曲"));
        } finally {
          isToggling = false;
        }

        return;
      }

      audio.pause();
    }
  };
}
