import { queryOptions, useQuery } from '@tanstack/react-query';
import { gql, graffleClient } from '../services/graffle-client';

// Define the metrics types based on the GraphQL schema
export interface GenreDistribution {
  genre: string;
  count: number;
}

export interface SubgenreDistribution {
  subgenre: string;
  count: number;
}

export interface YearDistribution {
  year: number;
  count: number;
}

export interface FormatDistribution {
  format: string;
  count: number;
}

export interface ListeningStats {
  totalPlays: number;
  totalPlayTime: number;
  averageConfidence: number;
  favoriteCount: number;
}

export interface TopArtist {
  artist: string;
  trackCount: number;
  totalDuration: number;
  averageConfidence: number;
}

export interface TopGenre {
  genre: string;
  trackCount: number;
  averageConfidence: number;
  averageDuration: number;
}

export interface RecentActivity {
  date: string;
  tracksAdded: number;
  tracksAnalyzed: number;
}

export interface LibraryMetrics {
  totalTracks: number;
  totalListeningTime: number;
  genreDistribution: GenreDistribution[];
  subgenreDistribution: SubgenreDistribution[];
  artistCount: number;
  yearDistribution: YearDistribution[];
  formatDistribution: FormatDistribution[];
  listeningStats: ListeningStats;
  topArtists: TopArtist[];
  topGenres: TopGenre[];
  recentActivity: RecentActivity[];
}

// Query Keys
export const metricsQueryKeys = {
  libraryMetrics: ['libraryMetrics'] as const,
};

/** Query options for loaders (ensureQueryData dedupes preload + load). */
export const libraryMetricsQueryOptions = () =>
  queryOptions({
    queryKey: metricsQueryKeys.libraryMetrics,
    queryFn: fetchLibraryMetrics,
  });

export const fetchLibraryMetrics = async (): Promise<LibraryMetrics> => {
  const response = await graffleClient.request<{
    libraryMetrics: LibraryMetrics;
  }>(gql`
        query GetLibraryMetrics {
          libraryMetrics {
            totalTracks
            totalListeningTime
            genreDistribution {
              genre
              count
            }
            subgenreDistribution {
              subgenre
              count
            }
            artistCount
            yearDistribution {
              year
              count
            }
            formatDistribution {
              format
              count
            }
            listeningStats {
              totalPlays
              totalPlayTime
              averageConfidence
              favoriteCount
            }
            topArtists {
              artist
              trackCount
              totalDuration
              averageConfidence
            }
            topGenres {
              genre
              trackCount
              averageConfidence
              averageDuration
            }
            recentActivity {
              date
              tracksAdded
              tracksAnalyzed
            }
          }
        }
      `);
  return response.libraryMetrics;
}

// Library Metrics Query
export const useLibraryMetrics = () => {
  return useQuery({
    queryKey: metricsQueryKeys.libraryMetrics,
    queryFn: fetchLibraryMetrics,
    staleTime: 5 * 60 * 1000, // 5 minutes - metrics don't change frequently
  });
};
