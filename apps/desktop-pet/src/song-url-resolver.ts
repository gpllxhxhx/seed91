type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type SongUrlResolverOptions = {
  apiBase: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

type SongRequestPath = "/song/url/v1" | "/song/url/match";

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const SONG_URL_LEVEL = "exhigh";

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

function extractSongUrl(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const responseData = payload as {
    audio_url?: unknown;
    data?: unknown;
    proxyUrl?: unknown;
    url?: unknown;
  };

  if (typeof responseData.proxyUrl === "string" && responseData.proxyUrl.trim()) {
    return responseData.proxyUrl.trim();
  }

  if (typeof responseData.url === "string" && responseData.url.trim()) {
    return responseData.url.trim();
  }

  if (typeof responseData.audio_url === "string" && responseData.audio_url.trim()) {
    return responseData.audio_url.trim();
  }

  if (typeof responseData.data === "string" && responseData.data.trim()) {
    return responseData.data.trim();
  }

  if (!Array.isArray(responseData.data) || responseData.data.length === 0) {
    if (responseData.data && typeof responseData.data === "object") {
      return extractSongUrl(responseData.data);
    }

    return "";
  }

  const firstItem = responseData.data[0];

  if (!firstItem || typeof firstItem !== "object") {
    return "";
  }

  const songData = firstItem as {
    proxyUrl?: unknown;
    url?: unknown;
  };

  if (typeof songData.proxyUrl === "string" && songData.proxyUrl.trim()) {
    return songData.proxyUrl.trim();
  }

  if (typeof songData.url === "string" && songData.url.trim()) {
    return songData.url.trim();
  }

  return "";
}

function normalizeResolvedSongUrl(songUrl: string, apiBase: string): string {
  try {
    return new URL(songUrl, `${apiBase}/`).toString();
  } catch {
    return songUrl;
  }
}

export function createSongUrlResolver(options: SongUrlResolverOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBase = options.apiBase.trim().replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  async function requestSongPayload(
    path: SongRequestPath,
    songId: string | number,
    unblock: boolean
  ): Promise<unknown> {
    if (!apiBase) {
      throw new Error("请求失败：未配置 VITE_MUSIC_API_BASE");
    }

    const requestUrl = new URL(path, `${apiBase}/`);
    requestUrl.searchParams.set("id", String(songId));
    requestUrl.searchParams.set("level", SONG_URL_LEVEL);

    if (unblock) {
      requestUrl.searchParams.set("unblock", "true");
    }

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

  return async (songId: string | number): Promise<string> => {
    let lastError: Error | null = null;

    const requestPlan: Array<{ path: SongRequestPath; unblock: boolean }> = [
      { path: "/song/url/v1", unblock: true },
      { path: "/song/url/match", unblock: false },
      { path: "/song/url/v1", unblock: false }
    ];

    for (const request of requestPlan) {
      try {
        const body = await requestSongPayload(request.path, songId, request.unblock);
        const songUrl = extractSongUrl(body);

        if (songUrl) {
          return normalizeResolvedSongUrl(songUrl, apiBase);
        }

        lastError = new Error("后端未返回歌曲 URL");
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error(String(error || "后端未返回歌曲 URL"));
      }
    }

    throw lastError ?? new Error("后端未返回歌曲 URL");
  };
}
