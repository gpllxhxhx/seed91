import { describe, expect, it } from "vitest";
import {
  addSavedPlaylist,
  buildSavedPlaylist,
  deleteSavedPlaylist,
  findSavedPlaylist
} from "./playlist-library";
import type { ResolvedPlaylist } from "./playlist-resolver";
import type { SavedPlaylist } from "./user-config";

const resolvedPlaylist: ResolvedPlaylist = {
  id: "13426747153",
  name: "桌宠测试歌单",
  cover: "https://example.com/playlist-cover.jpg",
  songs: [
    {
      id: 101,
      name: "第一首",
      artists: "歌手 A"
    },
    {
      id: 202,
      name: "第二首",
      artists: "歌手 B"
    }
  ]
};

function createSavedPlaylist(id: string): SavedPlaylist {
  return {
    id,
    name: `歌单 ${id}`,
    cover: "",
    trackCount: 1,
    tracks: [
      {
        id: Number(id),
        name: "歌曲",
        artists: "歌手"
      }
    ],
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z"
  };
}

describe("playlist-library", () => {
  it("builds a persisted playlist from resolved playlist details", () => {
    const savedPlaylist = buildSavedPlaylist(
      resolvedPlaylist,
      "2026-06-21T00:00:00.000Z"
    );

    expect(savedPlaylist).toEqual<SavedPlaylist>({
      id: "13426747153",
      name: "桌宠测试歌单",
      cover: "https://example.com/playlist-cover.jpg",
      trackCount: 2,
      tracks: resolvedPlaylist.songs,
      createdAt: "2026-06-21T00:00:00.000Z",
      updatedAt: "2026-06-21T00:00:00.000Z"
    });
  });

  it("adds a new playlist but refuses duplicates", () => {
    const firstPlaylist = createSavedPlaylist("1");
    const duplicatePlaylist = {
      ...createSavedPlaylist("1"),
      name: "重复歌单"
    };

    const firstResult = addSavedPlaylist([], firstPlaylist);
    const duplicateResult = addSavedPlaylist(firstResult.playlists, duplicatePlaylist);

    expect(firstResult.added).toBe(true);
    expect(duplicateResult.added).toBe(false);
    expect(duplicateResult.playlists).toEqual([firstPlaylist]);
  });

  it("deletes a saved playlist and clears the current playlist when needed", () => {
    const playlistA = createSavedPlaylist("1");
    const playlistB = createSavedPlaylist("2");

    const result = deleteSavedPlaylist([playlistA, playlistB], "1", "1");

    expect(result.playlists).toEqual([playlistB]);
    expect(result.currentPlaylistId).toBeNull();
  });

  it("finds saved playlist by id", () => {
    const playlist = createSavedPlaylist("9");

    expect(findSavedPlaylist([playlist], "9")).toBe(playlist);
    expect(findSavedPlaylist([playlist], "404")).toBeNull();
  });
});
