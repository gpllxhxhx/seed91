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

export type PlaybackStateSnapshot = {
  currentSong: PlaybackSong | null;
  currentSongIndex: number;
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
  onStateChange?: (snapshot: PlaybackStateSnapshot) => void;
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
  let playlistSongs: PlaybackSong[] = [];
  let currentSongIndex = -1;
  const songUrlCache = new Map<string, string>();
  let pendingSongUrl: Promise<string> | null = null;
  let pendingSongId = "";
  let isToggling = false;
  const emitStateChange = () => {
    options.onStateChange?.({
      currentSong,
      currentSongIndex
    });
  };

  setPaused(refs);
  clearError(refs);

  audio.addEventListener("play", () => {
    clearError(refs);
    setPlaying(refs);
  });

  audio.addEventListener("pause", () => {
    setPaused(refs);
  });

  audio.addEventListener("ended", async () => {
    if (playlistSongs.length > 0 && currentSongIndex >= 0) {
      if (currentSongIndex < playlistSongs.length - 1) {
        await controller.playSongAtIndex(currentSongIndex + 1);
        return;
      }

      clearError(refs);
      refs.stage.dataset.playbackState = "paused";
      refs.status.textContent = "播放结束";
      return;
    }

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

  const controller = {
    setQueue(songs: PlaybackSong[]): void {
      playlistSongs = songs.map((song) => ({ ...song }));

      if (playlistSongs.length === 0) {
        currentSongIndex = -1;
        emitStateChange();
        return;
      }

      const currentId = getCurrentSongId();

      if (!currentId) {
        currentSongIndex = -1;
        emitStateChange();
        return;
      }

      currentSongIndex = playlistSongs.findIndex(
        (song) => String(song.id) === currentId
      );
      emitStateChange();
    },
    getCurrentSongIndex(): number {
      return currentSongIndex;
    },
    getCurrentSong(): PlaybackSong | null {
      return currentSong;
    },
    async playSong(song: PlaybackSong): Promise<void> {
      currentSong = song;
      currentSongIndex = playlistSongs.findIndex(
        (item) => String(item.id) === String(song.id)
      );
      emitStateChange();

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
    async playSongAtIndex(index: number): Promise<void> {
      if (!Number.isInteger(index) || index < 0 || index >= playlistSongs.length) {
        showError(refs, "请先导入歌单");
        return;
      }

      currentSongIndex = index;
      await controller.playSong(playlistSongs[index]);
    },
    async playNext(): Promise<void> {
      if (playlistSongs.length === 0) {
        showError(refs, "请先导入歌单");
        return;
      }

      if (currentSongIndex < 0) {
        await controller.playSongAtIndex(0);
        return;
      }

      if (currentSongIndex >= playlistSongs.length - 1) {
        showError(refs, "已经是最后一首");
        return;
      }

      await controller.playSongAtIndex(currentSongIndex + 1);
    },
    async playPrevious(): Promise<void> {
      if (playlistSongs.length === 0) {
        showError(refs, "请先导入歌单");
        return;
      }

      if (currentSongIndex < 0) {
        await controller.playSongAtIndex(0);
        return;
      }

      if (currentSongIndex === 0) {
        showError(refs, "已经是第一首");
        return;
      }

      await controller.playSongAtIndex(currentSongIndex - 1);
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

  return controller;
}
