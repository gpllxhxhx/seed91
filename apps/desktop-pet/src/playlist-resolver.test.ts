import { describe, expect, it, vi } from "vitest";
import { createPlaylistResolver, parsePlaylistId } from "./playlist-resolver";

function createJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : "OK",
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

describe("parsePlaylistId", () => {
  it("returns a pure numeric input as the playlist id", () => {
    expect(parsePlaylistId("123456789")).toBe("123456789");
  });

  it("extracts the id from a music.163 hash playlist url", () => {
    expect(
      parsePlaylistId("https://music.163.com/#/playlist?id=123456789")
    ).toBe("123456789");
  });

  it("extracts the id from a music.163 playlist url", () => {
    expect(
      parsePlaylistId("https://music.163.com/playlist?id=123456789")
    ).toBe("123456789");
  });

  it("extracts the id from a y.music.163 mobile playlist url", () => {
    expect(
      parsePlaylistId("https://y.music.163.com/m/playlist?id=123456789")
    ).toBe("123456789");
  });

  it("throws a clear error when no playlist id can be parsed", () => {
    expect(() => parsePlaylistId("not-a-playlist")).toThrow("无法解析歌单 ID");
  });
});

describe("createPlaylistResolver", () => {
  it("normalizes playlist tracks into desktop playlist songs", async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        playlist: {
          name: "测试歌单",
          tracks: [
            {
              id: 101,
              name: "第一首",
              ar: [{ name: "歌手甲" }, { name: "歌手乙" }],
              al: { name: "专辑甲" }
            }
          ]
        }
      })
    );

    const resolvePlaylist = createPlaylistResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl
    });

    await expect(resolvePlaylist("123456789")).resolves.toEqual({
      id: "123456789",
      name: "测试歌单",
      songs: [
        {
          id: 101,
          name: "第一首",
          artists: "歌手甲 / 歌手乙",
          album: "专辑甲"
        }
      ]
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/playlist/detail?id=123456789",
      expect.objectContaining({
        cache: "no-store",
        method: "GET"
      })
    );
  });

  it("throws a clear error when the playlist has no songs", async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        playlist: {
          name: "空歌单",
          tracks: []
        }
      })
    );

    const resolvePlaylist = createPlaylistResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl
    });

    await expect(resolvePlaylist("123456789")).rejects.toThrow("歌单为空");
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

    const resolvePlaylist = createPlaylistResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl
    });

    await expect(resolvePlaylist("123456789")).rejects.toThrow("请求失败：HTTP 404");
  });
});
