type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type PlaylistSong = {
  id: number;
  name: string;
  artists: string;
  album?: string;
};

export type ResolvedPlaylist = {
  id: string;
  name: string;
  cover?: string;
  songs: PlaylistSong[];
};

type PlaylistResolverOptions = {
  apiBase: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

type PlaylistRequestPath = "/playlist/detail" | "/playlist/track/all";

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

function extractErrorDetail(body: unknown): string {
  if (!body) {
    return "";
  }

  if (typeof body === "string") {
    return body.trim();
  }

  if (typeof body === "object") {
    const candidate = body as {
      detail?: unknown;
      message?: unknown;
      msg?: unknown;
    };

    for (const value of [candidate.message, candidate.msg, candidate.detail]) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return "";
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function normalizeArtists(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((artist) => {
      if (!artist || typeof artist !== "object") {
        return "";
      }

      const name = (artist as { name?: unknown }).name;
      return typeof name === "string" ? name.trim() : "";
    })
    .filter(Boolean)
    .join(" / ");
}

function normalizeSongs(tracks: unknown): PlaylistSong[] {
  if (!Array.isArray(tracks)) {
    return [];
  }

  return tracks
    .map((track): PlaylistSong | null => {
      if (!track || typeof track !== "object") {
        return null;
      }

      const song = track as {
        id?: unknown;
        name?: unknown;
        ar?: unknown;
        al?: { name?: unknown } | null;
      };
      const id = Number(song.id);
      const name = typeof song.name === "string" ? song.name.trim() : "";

      if (!Number.isFinite(id) || !name) {
        return null;
      }

      const artists = normalizeArtists(song.ar) || "未知歌手";
      const albumName =
        song.al && typeof song.al.name === "string" ? song.al.name.trim() : "";

      return {
        id,
        name,
        artists,
        album: albumName || undefined
      };
    })
    .filter((song): song is PlaylistSong => Boolean(song));
}

function normalizeCover(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parsePlaylistId(rawInput: string): string {
  const input = rawInput.trim();

  if (/^\d+$/.test(input)) {
    return input;
  }

  const idMatch = input.match(/[?&]id=(\d{1,20})/);

  if (idMatch) {
    return idMatch[1];
  }

  const pathMatch = input.match(/\/playlist\/(\d{1,20})(?:[/?#]|$)/i);

  if (pathMatch) {
    return pathMatch[1];
  }

  throw new Error("无法解析歌单 ID");
}

export function createPlaylistResolver(options: PlaylistResolverOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBase = options.apiBase.trim().replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  async function requestPlaylistPayload(
    path: PlaylistRequestPath,
    searchParams: Record<string, string>
  ): Promise<unknown> {
    if (!apiBase) {
      throw new Error("请求失败：未配置 VITE_MUSIC_API_BASE");
    }

    const requestUrl = new URL(path, `${apiBase}/`);
    Object.entries(searchParams).forEach(([key, value]) => {
      requestUrl.searchParams.set(key, value);
    });

    let response: Response;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      response = await Promise.race([
        fetchImpl(requestUrl.toString(), {
          cache: "no-store",
          method: "GET"
        }),
        new Promise<Response>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error("请求超时：后端响应过慢"));
          }, timeoutMs);
        })
      ]);
    } catch (error) {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      if (error instanceof Error && error.message.includes("请求超时")) {
        throw error;
      }

      throw new Error(`请求失败：无法连接后端或被跨域策略拦截 (${apiBase})`);
    }

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    const body = await readResponseBody(response);

    if (!response.ok) {
      const detail = extractErrorDetail(body);
      throw new Error(
        detail
          ? `请求失败：HTTP ${response.status} ${detail}`
          : `请求失败：HTTP ${response.status}`
      );
    }

    return body;
  }

  async function fetchPlaylistTracks(
    playlistId: string,
    totalHint: number
  ): Promise<PlaylistSong[]> {
    const limit = 1000;
    let offset = 0;
    const songs: PlaylistSong[] = [];

    while (true) {
      const body = await requestPlaylistPayload("/playlist/track/all", {
        id: playlistId,
        limit: String(limit),
        offset: String(offset)
      });
      const pageSongs = normalizeSongs((body as { songs?: unknown }).songs);

      songs.push(...pageSongs);

      if (pageSongs.length < limit) {
        break;
      }

      offset += pageSongs.length;

      if (totalHint > 0 && songs.length >= totalHint) {
        break;
      }
    }

    return songs;
  }

  return async (rawInput: string): Promise<ResolvedPlaylist> => {
    const playlistId = parsePlaylistId(rawInput);
    const body = await requestPlaylistPayload("/playlist/detail", {
      id: playlistId
    });

    const payload = body as {
      playlist?: {
        name?: unknown;
        coverImgUrl?: unknown;
        picUrl?: unknown;
        trackCount?: unknown;
        tracks?: unknown;
      };
    };
    const playlistName =
      typeof payload.playlist?.name === "string"
        ? payload.playlist.name.trim()
        : "未命名歌单";
    const detailSongs = normalizeSongs(payload.playlist?.tracks);
    const trackCount = Number(payload.playlist?.trackCount);
    const shouldFetchFullTracks =
      detailSongs.length === 0 ||
      (Number.isFinite(trackCount) && trackCount > detailSongs.length);
    let songs = detailSongs;

    if (shouldFetchFullTracks) {
      try {
        const fullSongs = await fetchPlaylistTracks(
          playlistId,
          Number.isFinite(trackCount) ? trackCount : 0
        );

        if (fullSongs.length > 0) {
          songs = fullSongs;
        }
      } catch (error) {
        if (detailSongs.length === 0) {
          throw error;
        }
      }
    }

    if (songs.length === 0) {
      throw new Error("歌单为空");
    }

    return {
      id: playlistId,
      name: playlistName || "未命名歌单",
      cover:
        normalizeCover(payload.playlist?.coverImgUrl) ||
        normalizeCover(payload.playlist?.picUrl),
      songs
    };
  };
}
