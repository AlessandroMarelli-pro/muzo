import DataLoader from 'dataloader';
import {
  IPlaylistStatsQuery,
  PlaylistStatsDto,
} from 'src/clean-arch/application/ports/queries/IPlaylistStatsQuery';
import { extractModelId } from 'src/clean-arch/kernel/ids';
import { PlaylistId } from 'src/clean-arch/kernel/ids/scalars';

export const batchPlaylistStats = async (
  keys: readonly PlaylistId[],
  statsQuery: IPlaylistStatsQuery,
): Promise<PlaylistStatsDto[]> => {
  const pairs = await statsQuery.getPlaylistsStatsWithIds();
  const map = new Map<string, PlaylistStatsDto>();
  for (const { playlistId, stats } of pairs) {
    map.set(extractModelId(playlistId).dbId, stats);
  }
  return keys.map((id) => {
    const dbId = extractModelId(id).dbId;
    const stats = map.get(dbId);
    if (!stats) {
      // Optional: return empty stats or throw; DataLoader can also use Error.
      throw new Error(`Playlist stats not found for ${id}`);
    }
    return stats;
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
