import { describe, expect, it, vi } from "vitest";
import { createSongUrlResolver } from "./song-url-resolver";

function createJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : status === 403 ? "Forbidden" : "OK",
    headers: {
      get(name: string) {
        return name.toLowerCase() === "content-type"
          ? "application/json; charset=utf-8"
          : null;
      }
    },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  } as Response;
}

describe("createSongUrlResolver", () => {
  it("prefers data[0].proxyUrl from /song/url/v1 responses", async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        data: [
          {
            proxyUrl: "https://example.com/proxy.mp3",
            url: "https://example.com/original.mp3"
          }
        ]
      })
    );

    const resolveSongUrl = createSongUrlResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl
    });

    await expect(resolveSongUrl("1496089152")).resolves.toBe("https://example.com/proxy.mp3");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/song/url/v1?id=1496089152&level=exhigh&unblock=true",
      expect.objectContaining({
        cache: "no-store",
        method: "GET"
      })
    );
  });

  it("falls back to data[0].url when proxyUrl is empty", async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        data: [
          {
            proxyUrl: "",
            url: "https://example.com/song.mp3"
          }
        ]
      })
    );

    const resolveSongUrl = createSongUrlResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl
    });

    await expect(resolveSongUrl(1001)).resolves.toBe("https://example.com/song.mp3");
  });

  it("falls back to a top-level url field when the payload is wrapped differently", async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        url: "https://example.com/top-level.mp3"
      })
    );

    const resolveSongUrl = createSongUrlResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl
    });

    await expect(resolveSongUrl(1002)).resolves.toBe("https://example.com/top-level.mp3");
  });

  it("resolves relative audio urls against the configured API base", async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        data: [
          {
            proxyUrl: "/media/song.mp3",
            url: ""
          }
        ]
      })
    );

    const resolveSongUrl = createSongUrlResolver({
      apiBase: "http://127.0.0.1:3000/api",
      fetchImpl
    });

    await expect(resolveSongUrl(1002)).resolves.toBe("http://127.0.0.1:3000/media/song.mp3");
  });

  it("tries the match endpoint when enhanced unblock returns no playable url", async () => {
    const fetchImpl = vi.fn(async (input) => {
      const url = String(input);

      if (url.includes("/song/url/match")) {
        return createJsonResponse({
          data: {
            proxyUrl: "https://example.com/matched.mp3"
          }
        });
      }

      return createJsonResponse({
        data: [
          {
            proxyUrl: "",
            url: ""
          }
        ]
      });
    });

    const resolveSongUrl = createSongUrlResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl
    });

    await expect(resolveSongUrl(1006)).resolves.toBe("https://example.com/matched.mp3");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/song/url/match?id=1006&level=exhigh",
      expect.objectContaining({
        cache: "no-store",
        method: "GET"
      })
    );
  });

  it("uses the string data field returned by the match endpoint", async () => {
    const fetchImpl = vi.fn(async (input) => {
      const url = String(input);

      if (url.includes("/song/url/match")) {
        return createJsonResponse({
          code: 200,
          data: "https://example.com/matched-string.mp3",
          proxyUrl: ""
        });
      }

      return createJsonResponse({
        data: [
          {
            proxyUrl: "",
            url: ""
          }
        ]
      });
    });

    const resolveSongUrl = createSongUrlResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl
    });

    await expect(resolveSongUrl(1008)).resolves.toBe("https://example.com/matched-string.mp3");
  });

  it("falls back to the official endpoint when unblock and match do not return a playable url", async () => {
    const fetchImpl = vi.fn(async (input) => {
      const url = String(input);

      if (url.includes("unblock=true")) {
        return createJsonResponse({
          data: [
            {
              proxyUrl: "",
              url: ""
            }
          ]
        });
      }

      if (url.includes("/song/url/match")) {
        return createJsonResponse({
          data: [
            {
              proxyUrl: "",
              url: ""
            }
          ]
        });
      }

      return createJsonResponse({
        data: [
          {
            proxyUrl: "",
            url: "https://example.com/official.mp3"
          }
        ]
      });
    });

    const resolveSongUrl = createSongUrlResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl
    });

    await expect(resolveSongUrl(1007)).resolves.toBe("https://example.com/official.mp3");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:3000/song/url/v1?id=1007&level=exhigh",
      expect.objectContaining({
        cache: "no-store",
        method: "GET"
      })
    );
  });

  it("throws a request error when the backend responds with 404", async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse(
        {
          message: "Not Found"
        },
        404
      )
    );

    const resolveSongUrl = createSongUrlResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl
    });

    await expect(resolveSongUrl(1003)).rejects.toThrow("请求失败：HTTP 404");
  });

  it("throws a clear error when the backend response has no playable url", async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        data: [
          {
            proxyUrl: "",
            url: ""
          }
        ]
      })
    );

    const resolveSongUrl = createSongUrlResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl
    });

    await expect(resolveSongUrl(1004)).rejects.toThrow("后端未返回歌曲 URL");
  });

  it("throws a timeout error when the backend does not respond in time", async () => {
    const resolveSongUrl = createSongUrlResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl: async () => new Promise<Response>(() => {}),
      timeoutMs: 1
    });

    await expect(resolveSongUrl(1005)).rejects.toThrow("请求超时");
  });
});
