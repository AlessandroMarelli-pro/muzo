import DataLoader from 'dataloader';
import { IPlaylistTrackRepository } from 'src/application/ports/repositories/IPlaylistTrackRepository';
import { extractModelId } from 'src/kernel/ids';
import { MusicTrackId, PlaylistId } from 'src/kernel/ids/scalars';

const getCompositeKey = (
  playlistId: PlaylistId,
  trackId: MusicTrackId,
): string => {
  return `${extractModelId(playlistId).dbId}:${extractModelId(trackId).dbId}`;
};

export const batchPlaylistContainsTrack = async (
  keys: readonly { playlistId: PlaylistId; trackId: MusicTrackId }[],
  playlistTrackRepository: IPlaylistTrackRepository,
): Promise<boolean[]> => {
  const batches = await playlistTrackRepository.getPresenceBatch(
    keys as Array<{ playlistId: PlaylistId; trackId: MusicTrackId }>,
  );
  const map = new Map<string, boolean>();

  for (const track of batches) {
    const compositeKey = getCompositeKey(track.playlistId, track.trackId);
    if (!map.has(compositeKey)) {
      map.set(compositeKey, true);
    }
  }

  return keys.map((key) => {
    const compositeKey = getCompositeKey(key.playlistId, key.trackId);
    return map.get(compositeKey) || false;
  });
};

export type PlaylistContainsTrackLoader = DataLoader<
  { playlistId: PlaylistId; trackId: MusicTrackId },
  boolean
>;

export function createPlaylistContainsTrackLoader(
  playlistTrackRepository: IPlaylistTrackRepository,
): PlaylistContainsTrackLoader {
  return new DataLoader(
    (keys: readonly { playlistId: PlaylistId; trackId: MusicTrackId }[]) =>
      batchPlaylistContainsTrack(keys, playlistTrackRepository),
    { cacheKeyFn: (key) => getCompositeKey(key.playlistId, key.trackId) },
  );
}
