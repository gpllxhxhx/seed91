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
  songs: PlaylistSong[];
};

type PlaylistResolverOptions = {
  apiBase: string;
  fetchImpl?: FetchLike;
};

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

export function parsePlaylistId(rawInput: string): string {
  const input = rawInput.trim();

  if (/^\d+$/.test(input)) {
    return input;
  }

  const idMatch = input.match(/[?&]id=(\d{1,20})/);

  if (idMatch) {
    return idMatch[1];
  }

  throw new Error("无法解析歌单 ID");
}

export function createPlaylistResolver(options: PlaylistResolverOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBase = options.apiBase.trim().replace(/\/+$/, "");

  return async (rawInput: string): Promise<ResolvedPlaylist> => {
    if (!apiBase) {
      throw new Error("请求失败：未配置 VITE_MUSIC_API_BASE");
    }

    const playlistId = parsePlaylistId(rawInput);
    const requestUrl = new URL("/playlist/detail", `${apiBase}/`);
    requestUrl.searchParams.set("id", playlistId);

    let response: Response;

    try {
      response = await fetchImpl(requestUrl.toString(), {
        cache: "no-store",
        method: "GET"
      });
    } catch {
      throw new Error(`请求失败：无法连接后端或被跨域策略拦截 (${apiBase})`);
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

    const payload = body as {
      playlist?: {
        name?: unknown;
        tracks?: unknown;
      };
    };
    const playlistName =
      typeof payload.playlist?.name === "string"
        ? payload.playlist.name.trim()
        : "未命名歌单";
    const songs = normalizeSongs(payload.playlist?.tracks);

    if (songs.length === 0) {
      throw new Error("歌单为空");
    }

    return {
      id: playlistId,
      name: playlistName || "未命名歌单",
      songs
    };
  };
}
