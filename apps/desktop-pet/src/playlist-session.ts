import type { ResolvedPlaylist } from "./playlist-resolver";
import type { UserConfig } from "./user-config";

type QueueController = {
  setQueue: (songs: Array<{ id: number; name: string }>) => void;
};

export function getPersistedPlaylistRequest(config: UserConfig): string | null {
  const playlistId = config.player.playlistId?.trim();

  return playlistId || null;
}

export function populatePlaylistSession({
  playlist,
  artistsBySongId,
  playbackController
}: {
  playlist: ResolvedPlaylist;
  artistsBySongId: Map<string, string>;
  playbackController: QueueController;
}): void {
  playlist.songs.forEach((song) => {
    artistsBySongId.set(String(song.id), song.artists);
  });
  playbackController.setQueue(
    playlist.songs.map((song) => ({
      id: song.id,
      name: song.name
    }))
  );
}
