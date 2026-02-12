import DataLoader from 'dataloader';
import {
  IPlaylistStatsQuery,
  PlaylistStatsDto,
} from 'src/application/ports/queries/IPlaylistStatsQuery';
import { extractModelId } from 'src/kernel/ids';
import { PlaylistId } from 'src/kernel/ids/scalars';

const defaultPlaylistStats = (playlistId: PlaylistId): PlaylistStatsDto => ({
  playlistId,
  bpmRange: { min: 0, max: 0 },
  energyRange: { min: 0, max: 0 },
  genresCount: 0,
  subgenresCount: 0,
  topGenres: [],
  topSubgenres: [],
  numberOfTracks: 0,
  totalDuration: 0,
  images: [],
});
export const batchPlaylistStats = async (
  keys: readonly PlaylistId[],
  statsQuery: IPlaylistStatsQuery,
): Promise<PlaylistStatsDto[]> => {
  const pairs = await statsQuery.getPlaylistsStats();
  const map = new Map<string, PlaylistStatsDto>();
  for (const stat of pairs) {
    map.set(extractModelId(stat.playlistId).dbId, stat);
  }
  return keys.map((id) => {
    const dbId = extractModelId(id).dbId;
    return map.get(dbId) || defaultPlaylistStats(id);
  });
};

export type PlaylistStatsLoader = DataLoader<PlaylistId, PlaylistStatsDto>;

export function createPlaylistStatsLoader(
  statsQuery: IPlaylistStatsQuery,
): PlaylistStatsLoader {
  return new DataLoader((keys: readonly PlaylistId[]) =>
    batchPlaylistStats(keys, statsQuery),
  );
}
