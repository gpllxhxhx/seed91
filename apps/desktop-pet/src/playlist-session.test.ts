import { describe, expect, it } from "vitest";
import {
  getPersistedPlaylistRequest,
  populatePlaylistSession
} from "./playlist-session";
import type { ResolvedPlaylist } from "./playlist-resolver";
import type { UserConfig } from "./user-config";

describe("playlist session helpers", () => {
  it("uses the saved playlist id as the restore request", () => {
    const config = {
      player: {
        playlistId: "  123456  ",
        playlistName: "我的歌单"
      }
    } as UserConfig;

    expect(getPersistedPlaylistRequest(config)).toBe("123456");
  });

  it("returns null when no playlist id was saved", () => {
    const config = {
      player: {
        playlistId: null,
        playlistName: "只有名字"
      }
    } as UserConfig;

    expect(getPersistedPlaylistRequest(config)).toBeNull();
  });

  it("fills artist metadata and playback queue without starting playback", () => {
    const playlist: ResolvedPlaylist = {
      id: "123",
      name: "测试歌单",
      songs: [
        {
          id: 1,
          name: "第一首",
          artists: "歌手 A"
        },
        {
          id: 2,
          name: "第二首",
          artists: "歌手 B"
        }
      ]
    };
    const artistsBySongId = new Map<string, string>();
    const queueCalls: Array<Array<{ id: number; name: string }>> = [];

    populatePlaylistSession({
      playlist,
      artistsBySongId,
      playbackController: {
        setQueue: (songs) => {
          queueCalls.push(songs);
        }
      }
    });

    expect(artistsBySongId.get("1")).toBe("歌手 A");
    expect(artistsBySongId.get("2")).toBe("歌手 B");
    expect(queueCalls).toEqual([
      [
        {
          id: 1,
          name: "第一首"
        },
        {
          id: 2,
          name: "第二首"
        }
      ]
    ]);
  });
});
