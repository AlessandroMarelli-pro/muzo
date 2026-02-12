import { HomeMetrics } from '@/__generated__/types';
import { queryOptions } from '@tanstack/react-query';
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

export const fetchLibraryMetrics = async (): Promise<HomeMetrics> => {
	const response = await graffleClient.request<{
		me: { homeMetrics: HomeMetrics };
	}>(gql`
		query HomeMetrics {
			me {
				homeMetrics {
					totalTracks
					totalListeningTime
					artistCount
					listeningStats {
						totalPlays
						totalPlayTime
						favoriteCount
					}
					topArtists {
						artist
						trackCount
						totalDuration
					}
					topGenres {
						genre
						trackCount
					}
					recentActivity {
						date
						tracksAdded
						tracksAnalyzed
					}
				}
			}
		}
	`);
	return response.me.homeMetrics;
};
