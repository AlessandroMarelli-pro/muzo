import { PlaylistId } from 'src/clean-arch/kernel/ids';

export const PLAYLIST_STATS_QUERY = Symbol('IPlaylistStatsQuery');

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
  getPlaylistsStatsWithIds(): Promise<
    { playlistId: PlaylistId; stats: PlaylistStatsDto }[]
  >;
}
