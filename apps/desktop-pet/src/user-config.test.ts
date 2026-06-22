import { describe, expect, it } from "vitest";
import {
  defaultUserConfig,
  normalizeUserConfig,
  type UserConfig
} from "./user-config";

describe("normalizeUserConfig", () => {
  it("returns the default config when the stored value is missing or invalid", () => {
    expect(normalizeUserConfig(null)).toEqual(defaultUserConfig);
    expect(normalizeUserConfig("broken-json")).toEqual(defaultUserConfig);
    expect(normalizeUserConfig(42)).toEqual(defaultUserConfig);
  });

  it("merges partial config values while clamping invalid numeric fields", () => {
    const normalized = normalizeUserConfig({
      window: {
        x: 120,
        y: "bad",
        alwaysOnTop: true,
        opacity: 4
      },
      player: {
        volume: -1,
        muted: true,
        lastSong: {
          songId: "123",
          songName: "测试歌曲",
          artist: "测试歌手",
          cover: 99,
          progress: 15
        },
        playlistId: 12345,
        playlistName: "我的歌单",
        currentPlaylistId: 12345,
        savedPlaylists: [
          {
            id: 12345,
            name: "我的歌单",
            cover: " https://example.com/cover.jpg ",
            trackCount: 99,
            tracks: [
              {
                id: 1,
                name: "第一首",
                artists: "歌手"
              },
              {
                id: "bad",
                name: "",
                artists: ""
              }
            ],
            createdAt: "2026-06-20T00:00:00.000Z",
            updatedAt: "2026-06-21T00:00:00.000Z"
          }
        ]
      },
      pet: {
        selectedSkin: "classic",
        petSize: 0.2,
        showFloatingControls: false
      }
    });

    expect(normalized).toEqual<UserConfig>({
      window: {
        x: 120,
        y: null,
        alwaysOnTop: true,
        opacity: 1
      },
      player: {
        volume: 0,
        muted: true,
        lastSong: {
          songId: "123",
          songName: "测试歌曲",
          artist: "测试歌手",
          cover: "",
          progress: 15
        },
        playlistId: "12345",
        playlistName: "我的歌单",
        currentPlaylistId: "12345",
        savedPlaylists: [
          {
            id: "12345",
            name: "我的歌单",
            cover: "https://example.com/cover.jpg",
            trackCount: 1,
            tracks: [
              {
                id: 1,
                name: "第一首",
                artists: "歌手"
              }
            ],
            createdAt: "2026-06-20T00:00:00.000Z",
            updatedAt: "2026-06-21T00:00:00.000Z"
          }
        ]
      },
      pet: {
        selectedSkin: "classic",
        petSize: 0.5,
        showFloatingControls: false
      }
    });
  });

  it("drops malformed last-song payloads instead of crashing", () => {
    const normalized = normalizeUserConfig({
      player: {
        lastSong: {
          songId: "",
          songName: "  ",
          artist: "歌手"
        }
      }
    });

    expect(normalized.player.lastSong).toBeNull();
  });
});
