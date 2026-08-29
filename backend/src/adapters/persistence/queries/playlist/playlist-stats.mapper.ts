import type {
  PlaylistStatsDto,
  RawPlaylistStatsRow,
} from 'src/application/ports/queries/IPlaylistStatsQuery';
import { models } from 'src/kernel/types';

// Helper method to parse comma-separated string from STRING_AGG
function parseCommaSeparated(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').filter((item) => item.trim() !== '');
}

// Helper method to get top N most frequent items
function getTopItems(items: string[], limit: number): string[] {
  if (!items || items.length === 0) return [];

  const frequency: Record<string, number> = {};
  items.forEach((item) => {
    frequency[item] = (frequency[item] || 0) + 1;
  });

  return Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([item]) => item);
}

export function mapRawRowToPlaylistStatsDto(row: RawPlaylistStatsRow): PlaylistStatsDto {
  return {
    playlistId: models.playlist.id(row.id),
    bpmRange: { min: Number(row.bpmMin), max: Number(row.bpmMax) },
    genresCount: Number(row.genresCount),
    subgenresCount: Number(row.subgenresCount),
    topGenres: getTopItems(parseCommaSeparated(row.allGenres), 5),
    topSubgenres: getTopItems(parseCommaSeparated(row.allSubgenres), 5),
    numberOfTracks: Number(row.numberOfTracks),
    totalDuration: parseFloat(String(row.totalDuration)),
    images: parseCommaSeparated(row.allImages),
  };
}
