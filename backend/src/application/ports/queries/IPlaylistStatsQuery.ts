import { PlaylistId } from 'src/kernel/ids';
import { createToken } from '../../utils/create-token';

export const PLAYLIST_STATS_QUERY = createToken<IPlaylistStatsQuery>(
  'PLAYLIST_STATS_QUERY',
);

export interface RangeDto {
  min: number;
  max: number;
}
export interface PlaylistStatsDto {
  playlistId: PlaylistId;
  bpmRange: RangeDto;
  energyRange: RangeDto;
  genresCount: number;
  subgenresCount: number;
  topGenres: string[];
  topSubgenres: string[];
  numberOfTracks: number;
  totalDuration: number;
  images: string[];
}

export type RawPlaylistStatsRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  numberOfTracks: number;
  totalDuration: number;
  bpmMin: number;
  bpmMax: number;
  energyMin: number;
  energyMax: number;
  genresCount: number;
  subgenresCount: number;
  allGenres: string | null;
  allSubgenres: string | null;
  allImages?: string | null;
  isTrackInPlaylist?: number | null;
};

export interface IPlaylistStatsQuery {
  getPlaylistStats(playlistId: PlaylistId): Promise<PlaylistStatsDto>;
  getPlaylistsStats(): Promise<PlaylistStatsDto[]>;
}
