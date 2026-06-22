import type { ResolvedPlaylist } from "./playlist-resolver";
import type { SavedPlaylist } from "./user-config";

export function buildSavedPlaylist(
  playlist: ResolvedPlaylist,
  timestamp = new Date().toISOString()
): SavedPlaylist {
  return {
    id: playlist.id,
    name: playlist.name,
    cover: playlist.cover?.trim() ?? "",
    trackCount: playlist.songs.length,
    tracks: playlist.songs.map((song) => ({ ...song })),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function addSavedPlaylist(
  playlists: SavedPlaylist[],
  playlist: SavedPlaylist
): { added: boolean; playlists: SavedPlaylist[] } {
  if (playlists.some((item) => item.id === playlist.id)) {
    return {
      added: false,
      playlists
    };
  }

  return {
    added: true,
    playlists: [...playlists, playlist]
  };
}

export function deleteSavedPlaylist(
  playlists: SavedPlaylist[],
  playlistId: string,
  currentPlaylistId: string | null
): { playlists: SavedPlaylist[]; currentPlaylistId: string | null } {
  const remainingPlaylists = playlists.filter((playlist) => playlist.id !== playlistId);

  return {
    playlists: remainingPlaylists,
    currentPlaylistId: currentPlaylistId === playlistId ? null : currentPlaylistId
  };
}

export function findSavedPlaylist(
  playlists: SavedPlaylist[],
  playlistId: string | null
): SavedPlaylist | null {
  if (!playlistId) {
    return null;
  }

  return playlists.find((playlist) => playlist.id === playlistId) ?? null;
}

export function savedPlaylistToResolvedPlaylist(
  playlist: SavedPlaylist
): ResolvedPlaylist {
  return {
    id: playlist.id,
    name: playlist.name,
    cover: playlist.cover,
    songs: playlist.tracks.map((track) => ({ ...track }))
  };
}
