export const METRICS_QUERY = Symbol('IMetricsQuery');

export interface MetricsDto {
  totalTracks: number;
  totalListeningTime: number;
  artistCount: number;
  listeningStats: ListeningStatsDto;
  topArtists: TopArtistDto[];
  topGenres: TopGenreDto[];
  recentActivity: RecentActivityDto[];
}

export interface ListeningStatsDto {
  totalPlays: number;
  totalPlayTime: number;
  favoriteCount: number;
}

export interface TopArtistDto {
  artist: string;
  trackCount: number;
  totalDuration: number;
}

export interface TopGenreDto {
  genre: string;
  trackCount: number;
}

export interface RecentActivityDto {
  date: string;
  tracksAdded: number;
  tracksAnalyzed: number;
}

export interface IMetricsQuery {
  getMetrics(): Promise<MetricsDto>;
}
