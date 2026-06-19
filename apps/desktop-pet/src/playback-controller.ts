type AudioLike = EventTarget & {
  paused: boolean;
  src: string;
  play: () => Promise<void>;
  pause: () => void;
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
  resolveSongUrl: () => Promise<string>;
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
  let cachedSongUrl = "";
  let pendingSongUrl: Promise<string> | null = null;
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

  async function ensureSongUrl(): Promise<string> {
    if (cachedSongUrl) {
      return cachedSongUrl;
    }

    if (!pendingSongUrl) {
      setLoading(refs);
      clearError(refs);

      pendingSongUrl = options.resolveSongUrl()
        .then((resolvedSongUrl) => {
          const normalizedSongUrl = resolvedSongUrl.trim();

          if (!normalizedSongUrl) {
            throw new Error("后端未返回歌曲 URL");
          }

          if (!isValidSongUrl(normalizedSongUrl)) {
            throw new Error("后端返回的歌曲 URL 无效");
          }

          cachedSongUrl = normalizedSongUrl;
          return normalizedSongUrl;
        })
        .finally(() => {
          pendingSongUrl = null;
        });
    }

    return pendingSongUrl;
  }

  return {
    async togglePlayback(): Promise<void> {
      if (isToggling) {
        return;
      }

      if (audio.paused) {
        isToggling = true;
        clearError(refs);

        try {
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
