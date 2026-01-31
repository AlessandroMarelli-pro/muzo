import DataLoader from 'dataloader';
import { PlaylistTrackWithTrackDetail } from 'src/clean-arch/application/dtos/PlaylistTrackWithDetail';
import { IPlaylistTrackRepository } from 'src/clean-arch/application/ports/repositories/IPlaylistTrackRepository';
import { extractModelId } from 'src/clean-arch/kernel/ids';
import { PlaylistId } from 'src/clean-arch/kernel/ids/scalars';

export const batchPlaylistTracksWithTrack = async (
  keys: readonly PlaylistId[],
  playlistTrackRepository: IPlaylistTrackRepository,
): Promise<PlaylistTrackWithTrackDetail[][]> => {
  const tracks = await playlistTrackRepository.getTracksWithTrack();

  const map = new Map<string, PlaylistTrackWithTrackDetail[]>();
  for (const track of tracks) {
    const playlistId = extractModelId(track.playlistId).dbId;
    if (!map.has(playlistId)) {
      map.set(playlistId, []);
    }
    map.get(playlistId).push(track);
  }

  return keys.map((id) => {
    const dbId = extractModelId(id).dbId;

    return map.get(dbId) || [];
  });
};

export type PlaylistTracksWithTrackLoader = DataLoader<
  PlaylistId,
  PlaylistTrackWithTrackDetail[]
>;

export function createPlaylistTracksWithTrackLoader(
  playlistTrackRepository: IPlaylistTrackRepository,
): PlaylistTracksWithTrackLoader {
  return new DataLoader((keys: readonly PlaylistId[]) =>
    batchPlaylistTracksWithTrack(keys, playlistTrackRepository),
  );
}
