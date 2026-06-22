export type PersistedSong = {
  songId: string;
  songName: string;
  artist: string;
  cover: string;
  progress: number | null;
};

export type SavedPlaylistTrack = {
  id: number;
  name: string;
  artists: string;
  album?: string;
};

export type SavedPlaylist = {
  id: string;
  name: string;
  cover: string;
  trackCount: number;
  tracks: SavedPlaylistTrack[];
  createdAt: string;
  updatedAt: string;
};

export type UserConfig = {
  window: {
    x: number | null;
    y: number | null;
    alwaysOnTop: boolean;
    opacity: number;
  };
  player: {
    volume: number;
    muted: boolean;
    lastSong: PersistedSong | null;
    playlistId: string | null;
    playlistName: string | null;
    currentPlaylistId: string | null;
    savedPlaylists: SavedPlaylist[];
  };
  pet: {
    selectedSkin: string;
    petSize: number;
    showFloatingControls: boolean;
  };
};

export const defaultUserConfig: UserConfig = {
  window: {
    x: null,
    y: null,
    alwaysOnTop: true,
    opacity: 1
  },
  player: {
    volume: 0.7,
    muted: false,
    lastSong: null,
    playlistId: null,
    playlistName: null,
    currentPlaylistId: null,
    savedPlaylists: []
  },
  pet: {
    selectedSkin: "default",
    petSize: 1,
    showFloatingControls: true
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeLastSong(value: unknown): PersistedSong | null {
  if (!isRecord(value)) {
    return null;
  }

  const songId = normalizeString(value.songId);
  const songName = normalizeString(value.songName);

  if (!songId || !songName) {
    return null;
  }

  const artist = normalizeString(value.artist);
  const cover = normalizeString(value.cover);
  const progress =
    typeof value.progress === "number" && Number.isFinite(value.progress)
      ? value.progress
      : null;

  return {
    songId,
    songName,
    artist,
    cover,
    progress
  };
}

function normalizeSavedPlaylistTrack(value: unknown): SavedPlaylistTrack | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "number" ? value.id : Number(value.id);
  const name = normalizeString(value.name);

  if (!Number.isFinite(id) || !name) {
    return null;
  }

  const artists = normalizeString(value.artists) || "未知歌手";
  const album = normalizeString(value.album);

  return {
    id,
    name,
    artists,
    ...(album ? { album } : {})
  };
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  const text = normalizeString(value);

  if (!text || Number.isNaN(Date.parse(text))) {
    return fallback;
  }

  return text;
}

function normalizeSavedPlaylists(value: unknown): SavedPlaylist[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenPlaylistIds = new Set<string>();

  return value
    .map((item): SavedPlaylist | null => {
      if (!isRecord(item)) {
        return null;
      }

      const id = normalizeNullableString(item.id);
      const name = normalizeString(item.name);
      const tracks = Array.isArray(item.tracks)
        ? item.tracks
            .map(normalizeSavedPlaylistTrack)
            .filter((track): track is SavedPlaylistTrack => Boolean(track))
        : [];

      if (!id || !name || tracks.length === 0 || seenPlaylistIds.has(id)) {
        return null;
      }

      seenPlaylistIds.add(id);

      const createdAt = normalizeTimestamp(item.createdAt, "1970-01-01T00:00:00.000Z");

      return {
        id,
        name,
        cover: normalizeString(item.cover),
        trackCount: tracks.length,
        tracks,
        createdAt,
        updatedAt: normalizeTimestamp(item.updatedAt, createdAt)
      };
    })
    .filter((playlist): playlist is SavedPlaylist => Boolean(playlist));
}

export function normalizeUserConfig(value: unknown): UserConfig {
  if (!isRecord(value)) {
    return structuredClone(defaultUserConfig);
  }

  const windowValue = isRecord(value.window) ? value.window : {};
  const playerValue = isRecord(value.player) ? value.player : {};
  const petValue = isRecord(value.pet) ? value.pet : {};
  const playlistId = normalizeNullableString(playerValue.playlistId);

  return {
    window: {
      x: normalizeNullableNumber(windowValue.x),
      y: normalizeNullableNumber(windowValue.y),
      alwaysOnTop:
        typeof windowValue.alwaysOnTop === "boolean"
          ? windowValue.alwaysOnTop
          : defaultUserConfig.window.alwaysOnTop,
      opacity: clampNumber(
        windowValue.opacity,
        defaultUserConfig.window.opacity,
        0.2,
        1
      )
    },
    player: {
      volume: clampNumber(playerValue.volume, defaultUserConfig.player.volume, 0, 1),
      muted:
        typeof playerValue.muted === "boolean"
          ? playerValue.muted
          : defaultUserConfig.player.muted,
      lastSong: normalizeLastSong(playerValue.lastSong),
      playlistId,
      playlistName: normalizeNullableString(playerValue.playlistName),
      currentPlaylistId: normalizeNullableString(playerValue.currentPlaylistId) ?? playlistId,
      savedPlaylists: normalizeSavedPlaylists(playerValue.savedPlaylists)
    },
    pet: {
      selectedSkin: normalizeString(petValue.selectedSkin) || defaultUserConfig.pet.selectedSkin,
      petSize: clampNumber(petValue.petSize, defaultUserConfig.pet.petSize, 0.5, 2),
      showFloatingControls:
        typeof petValue.showFloatingControls === "boolean"
          ? petValue.showFloatingControls
          : defaultUserConfig.pet.showFloatingControls
    }
  };
}
