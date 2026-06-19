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
      songId: "1496089152",
      fetchImpl
    });

    await expect(resolveSongUrl()).resolves.toBe("https://example.com/proxy.mp3");
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
      songId: "1496089152",
      fetchImpl
    });

    await expect(resolveSongUrl()).resolves.toBe("https://example.com/song.mp3");
  });

  it("falls back to a top-level url field when the payload is wrapped differently", async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        url: "https://example.com/top-level.mp3"
      })
    );

    const resolveSongUrl = createSongUrlResolver({
      apiBase: "http://127.0.0.1:3000",
      songId: "1496089152",
      fetchImpl
    });

    await expect(resolveSongUrl()).resolves.toBe("https://example.com/top-level.mp3");
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
      songId: "1496089152",
      fetchImpl
    });

    await expect(resolveSongUrl()).rejects.toThrow("请求失败：HTTP 404");
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
      songId: "1496089152",
      fetchImpl
    });

    await expect(resolveSongUrl()).rejects.toThrow("后端未返回歌曲 URL");
  });
});
