type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type SongUrlResolverOptions = {
  apiBase: string;
  songId: string;
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

function extractSongUrl(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const responseData = payload as {
    data?: unknown;
    url?: unknown;
  };

  if (typeof responseData.url === "string" && responseData.url.trim()) {
    return responseData.url.trim();
  }

  if (!Array.isArray(responseData.data) || responseData.data.length === 0) {
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

export function createSongUrlResolver(options: SongUrlResolverOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBase = options.apiBase.trim().replace(/\/+$/, "");

  return async (): Promise<string> => {
    if (!apiBase) {
      throw new Error("请求失败：未配置 VITE_MUSIC_API_BASE");
    }

    const requestUrl = new URL("/song/url/v1", `${apiBase}/`);
    requestUrl.searchParams.set("id", options.songId);
    requestUrl.searchParams.set("level", "exhigh");
    requestUrl.searchParams.set("unblock", "true");

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

    const songUrl = extractSongUrl(body);

    if (!songUrl) {
      throw new Error("后端未返回歌曲 URL");
    }

    return songUrl;
  };
}
