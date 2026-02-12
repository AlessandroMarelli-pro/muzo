import DataLoader from 'dataloader';
import { IPlaylistTrackRepository } from 'src/application/ports/repositories/IPlaylistTrackRepository';
import { extractModelId } from 'src/kernel/ids';
import { PlaylistId } from 'src/kernel/ids/scalars';
import { PlaylistTrack } from 'src/kernel/types/model-types';

export const batchPlaylistTracks = async (
  keys: readonly PlaylistId[],
  playlistTrackRepository: IPlaylistTrackRepository,
): Promise<PlaylistTrack[][]> => {
  const tracks = await playlistTrackRepository.getTracks();
  const map = new Map<string, PlaylistTrack[]>();
  for (const track of tracks) {
    const playlistId = extractModelId(track.playlistId).dbId;
    if (!map.has(playlistId)) {
      map.set(playlistId, []);
    }
    map.get(playlistId)?.push(track);
  }

  return keys.map((id) => {
    const dbId = extractModelId(id).dbId;

    return map.get(dbId) || [];
  });
};

export type PlaylistTracksLoader = DataLoader<PlaylistId, PlaylistTrack[]>;

export function createPlaylistTracksLoader(
  playlistTrackRepository: IPlaylistTrackRepository,
): PlaylistTracksLoader {
  return new DataLoader((keys: readonly PlaylistId[]) =>
    batchPlaylistTracks(keys, playlistTrackRepository),
  );
}
