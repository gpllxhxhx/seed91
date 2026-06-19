type AudioLike = EventTarget & {
  paused: boolean;
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

function setPaused(refs: PlaybackRefs): void {
  refs.stage.dataset.playbackState = "paused";
  refs.status.textContent = "已暂停";
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
  refs.error.textContent = `播放失败：${message}`;
  refs.error.hidden = false;
}

export function createPlaybackController(audio: AudioLike, refs: PlaybackRefs) {
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
    showError(refs, "无法播放 /audio/test-song.mp3");
  });

  return {
    async togglePlayback(): Promise<void> {
      if (audio.paused) {
        clearError(refs);

        try {
          await audio.play();
        } catch (error) {
          setPaused(refs);
          showError(
            refs,
            error instanceof Error ? error.message : "无法播放 /audio/test-song.mp3"
          );
        }

        return;
      }

      audio.pause();
    }
  };
}
