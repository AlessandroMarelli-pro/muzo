import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { parse } from 'graphql';
import type {
	CreateLibraryInput,
	GetRecentlyPlayedQuery,
	MusicLibrary,
	MusicTrack,
	MusicTrackListPaginated,
	RandomTrackWithStats,
	SimpleMusicTrack,
	StaticFilterOptions,
	TrackRecommendation,
	UpdateLibraryInput,
} from '../__generated__/types';
import { trackFragment } from './fragments';
import { gql, graffleClient } from './graffle-client';
import { simpleMusicTrackFragment } from './playlist-hooks';

// Define AnalysisStatus enum locally since it's not in the generated types
export type AnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Define LibraryScanStatus enum locally since it's not in the generated types
export type LibraryScanStatus =
	| 'IDLE'
	| 'SCANNING'
	| 'ANALYZING'
	| 'PAUSED'
	| 'ERROR';

// Define PlaybackSession locally since it's not in the generated types
export type PlaybackSession = {
	id: string;
	trackId: string;
	status: string;
	currentPosition: number;
	duration: number;
	volume: number;
	isShuffled: boolean;
	repeatMode: string;
	currentIndex: number;
	startedAt?: string;
	pausedAt?: string;
	track: MusicTrack;
};

// Query Keys
export const queryKeys = {
	libraries: ['libraries'] as const,
	library: (id: string) => ['libraries', id] as const,
	tracks: (
		libraryId?: string,
		status?: AnalysisStatus,
		isFavorite?: boolean,
		orderBy?: string,
		orderDirection?: 'asc' | 'desc'
	) =>
		[
			'tracks',
			{ libraryId, status, isFavorite, orderBy, orderDirection },
		] as const,
	tracksList: (
		libraryId?: string,
		status?: AnalysisStatus,
		isFavorite?: boolean,
		limit?: number,
		offset?: number,
		orderBy?: string,
		orderDirection?: 'asc' | 'desc'
	) =>
		[
			'tracksList',
			{ libraryId, status, isFavorite, limit, offset, orderBy, orderDirection },
		] as const,

	recentlyPlayed: (limit?: number) =>
		['tracks', 'recently-played', { limit }] as const,

	currentPlayback: ['playback', 'current'] as const,
	staticFilters: ['static-filters'] as const,
	randomTrack: (id?: string, filterLiked?: boolean) =>
		['tracks', 'random', { id, filterLiked }] as const,
	randomTrackWithStats: () => ['tracks', 'random-with-stats'] as const,
	trackRecommendations: (id?: string, criteria?: string) =>
		['tracks', 'recommendations', { id, criteria }] as const,
};

/** Query options for loaders (ensureQueryData dedupes preload + load). */
export const recentlyPlayedQueryOptions = (limit = 20) =>
	queryOptions({
		queryKey: queryKeys.recentlyPlayed(limit),
		queryFn: () => fetchRecentlyPlayed(limit),
	});

export const librariesQueryOptions = () =>
	queryOptions({
		queryKey: queryKeys.libraries,
		queryFn: fetchLibraries,
	});

export const randomTrackQueryOptions = (id?: string, filterLiked?: boolean) =>
	queryOptions({
		queryKey: queryKeys.randomTrack(id, filterLiked),
		queryFn: () => fetchRandomTrack(id, filterLiked),
	});

export const trackRecommendationsQueryOptions = (
	id?: string,
	criteria?: string
) =>
	queryOptions({
		queryKey: queryKeys.trackRecommendations(id, criteria),
		queryFn: () => fetchTrackRecommendations(id, criteria),
	});

export const fetchLibraries = async () => {
	const response = await graffleClient.request<{
		libraries: MusicLibrary[];
	}>(gql`
		query GetLibraries {
			libraries {
				id
				name
				rootPath
				totalTracks
				analyzedTracks
				pendingTracks
				failedTracks
				lastScanAt
				lastIncrementalScanAt
				scanStatus
				settings {
					autoScan
					scanInterval
					includeSubdirectories
					supportedFormats
					maxFileSize
				}
				createdAt
				updatedAt
			}
		}
	`);
	return response.libraries;
};

// Library Queries
export const useLibraries = () => {
	return useQuery({
		queryKey: queryKeys.libraries,
		queryFn: fetchLibraries,
	});
};

export const useLibrary = (id: string) => {
	return useQuery({
		queryKey: queryKeys.library(id),
		queryFn: async () => {
			const response = await graffleClient.request<{ library: MusicLibrary }>({
				document: parse(gql`
					query GetLibrary($id: ID!) {
						library(id: $id) {
							id
							name
							rootPath
							totalTracks
							analyzedTracks
							pendingTracks
							failedTracks
							lastScanAt
							lastIncrementalScanAt
							scanStatus
							settings {
								autoScan
								scanInterval
								includeSubdirectories
								supportedFormats
								maxFileSize
							}
							createdAt
							updatedAt
						}
					}
				`),
				variables: { id },
			});
			return response.library;
		},
		enabled: !!id,
	});
};

// Track Queries
export const useTracks = ({
	libraryId,
	status,
	isFavorite,
	orderBy = 'fileCreatedAt',
	orderDirection = 'asc',
}: {
	libraryId?: string;
	status?: AnalysisStatus;
	isFavorite?: boolean;
	orderBy?: string;
	orderDirection?: 'asc' | 'desc';
}) => {
	return useQuery({
		queryKey: queryKeys.tracks(
			libraryId,
			status,
			isFavorite,
			orderBy,
			orderDirection
		),
		queryFn: async () => {
			const response = await graffleClient.request<{
				tracks: SimpleMusicTrack[];
			}>(
				gql`
					${simpleMusicTrackFragment}
					query GetTracks($options: TrackQueryOptions) {
						tracks(options: $options) {
							...SimpleMusicTrackFragment
						}
					}
				`,
				{
					options: {
						libraryId,
						analysisStatus: status,
						isFavorite,
						orderBy,
						orderDirection,
					},
				}
			);
			return response.tracks;
		},
	});
};

export const fetchRandomTrack = async (id?: string, filterLiked?: boolean) => {
	const response = await graffleClient.request<{
		randomTrack: SimpleMusicTrack;
	}>(
		gql`
			${simpleMusicTrackFragment}
			query GetRandomTrack($id: String, $filterLiked: Boolean) {
				randomTrack(id: $id, filterLiked: $filterLiked) {
					...SimpleMusicTrackFragment
				}
			}
		`,
		{ id, filterLiked }
	);
	return response.randomTrack;
};

export const useRandomTrack = (id?: string, filterLiked?: boolean) => {
	return useQuery({
		queryKey: queryKeys.randomTrack(id, filterLiked),
		queryFn: async () => fetchRandomTrack(id, filterLiked),
	});
};

export const fetchRandomTrackWithStats = async () => {
	const response = await graffleClient.request<{
		randomTrackWithStats: RandomTrackWithStats;
	}>(gql`
		${simpleMusicTrackFragment}
		query GetRandomTrackWithStats {
			randomTrackWithStats {
				track {
					...SimpleMusicTrackFragment
				}
				likedCount
				bangerCount
				dislikedCount
				remainingCount
			}
		}
	`);
	return response.randomTrackWithStats;
};
export const useRandomTrackWithStats = () => {
	return useQuery({
		queryKey: queryKeys.randomTrackWithStats(),
		queryFn: fetchRandomTrackWithStats,
	});
};

export const fetchTrackRecommendations = async (
	id?: string,
	criteria?: string
) => {
	const response = await graffleClient.request<{
		trackRecommendations: TrackRecommendation[];
	}>(
		gql`
			${trackFragment}
			query GetTrackRecommendations(
				$trackId: Base64ID!
				$recommendationsLimit: Int
			) {
				node(id: $trackId) {
					... on Track {
						recommendations(limit: $recommendationsLimit) {
							track {
								...TrackFragment
							}
							similarity
							reasons
						}
					}
				}
			}
		`,
		{ trackId: id, recommendationsLimit: 20 }
	);
	return response.trackRecommendations;
};
export const useTrackRecommendations = (id?: string, criteria?: string) => {
	return useQuery({
		enabled: !!id,
		queryKey: queryKeys.trackRecommendations(id, criteria),
		queryFn: async () => fetchTrackRecommendations(id, criteria),
	});
};

export const useTracksList = ({
	libraryId,
	status,
	isFavorite,
	limit = 50,
	offset = 0,
	orderBy = 'createdAt',
	orderDirection = 'desc',
}: {
	libraryId?: string;
	status?: AnalysisStatus;
	isFavorite?: boolean;
	limit?: number;
	offset?: number;
	orderBy?: string;
	orderDirection?: 'asc' | 'desc';
}) => {
	return useQuery({
		queryKey: queryKeys.tracksList(
			libraryId,
			status,
			isFavorite,
			limit,
			offset,
			orderBy,
			orderDirection
		),
		queryFn: async () => {
			const response = await graffleClient.request<{
				tracksList: MusicTrackListPaginated;
			}>(
				gql`
					${simpleMusicTrackFragment}
					query GetTracksList($options: TrackQueryOptions) {
						tracksList(options: $options) {
							tracks {
								...SimpleMusicTrackFragment
							}
							total
							page
							limit
						}
					}
				`,
				{
					options: {
						libraryId,
						analysisStatus: status,
						isFavorite,
						limit,
						offset,
						orderBy,
						orderDirection,
					},
				}
			);
			return response.tracksList;
		},
	});
};

// Static Filters Query
export const useStaticFilters = () => {
	return useQuery({
		queryKey: queryKeys.staticFilters,
		queryFn: async () => {
			const response = await graffleClient.request<{
				me: { staticFilterOptions: StaticFilterOptions };
			}>(gql`
				query GetStaticFilters {
					me {
						staticFilterOptions {
							genres {
								id
								name
							}
							subgenres {
								id
								name
							}
							keys {
								id
								name
							}
							libraries {
								id
								name
							}
							atmospheres {
								id
								name
							}
						}
					}
				}
			`);
			return response.me.staticFilterOptions;
		},
		staleTime: 10 * 60 * 1000, // 10 minutes - static data doesn't change often
	});
};
export const fetchRecentlyPlayed = async (limit = 20) => {
	const response = await graffleClient.request<GetRecentlyPlayedQuery>(
		gql`
			${simpleMusicTrackFragment}
			query GetRecentlyPlayed($limit: Float) {
				recentlyPlayed(limit: $limit) {
					...SimpleMusicTrackFragment
				}
			}
		`,
		{ limit }
	);
	return response.recentlyPlayed;
};

// Playback Queries
export const useRecentlyPlayed = (limit = 20) => {
	return useQuery({
		queryKey: queryKeys.recentlyPlayed(limit),
		queryFn: () => fetchRecentlyPlayed(limit),
	});
};

// Note: currentPlayback query removed as it doesn't exist in the schema
// export const useCurrentPlayback = () => { ... };

// Mutations
export const useCreateLibrary = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: CreateLibraryInput) => {
			const response = await graffleClient.request<{
				createLibrary: MusicLibrary;
			}>(
				parse(
					`
          mutation CreateLibrary($input: CreateLibraryInput!) {
            createLibrary(input: $input) {
              id
              name
              rootPath
              totalTracks
              analyzedTracks
              pendingTracks
              failedTracks
              scanStatus
              settings {
                autoScan
                scanInterval
                includeSubdirectories
                supportedFormats
                maxFileSize
              }
              createdAt
              updatedAt
            }
          }
        `
				),
				{ input }
			);
			return response.createLibrary;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.libraries });
		},
	});
};

export const useUpdateLibrary = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			input,
		}: {
			id: string;
			input: UpdateLibraryInput;
		}) => {
			const response = await graffleClient.request<{
				updateLibrary: MusicLibrary;
			}>(
				gql(
					`
          mutation UpdateLibrary($id: ID!, $input: UpdateLibraryInput!) {
            updateLibrary(id: $id, input: $input) {
              id
              name
              rootPath
              totalTracks
              analyzedTracks
              pendingTracks
              failedTracks
              scanStatus
              settings {
                autoScan
                scanInterval
                includeSubdirectories
                supportedFormats
                maxFileSize
              }
              createdAt
              updatedAt
            }
          }
        ` as any
				),
				{ id, input }
			);
			return response.updateLibrary;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.libraries });
			queryClient.invalidateQueries({ queryKey: queryKeys.library(data.id) });
		},
	});
};

export const useDeleteLibrary = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			const response = await graffleClient.request<{ deleteLibrary: boolean }>(
				parse(
					`
          mutation DeleteLibrary($id: ID!) {
            deleteLibrary(id: $id)
          }
        ` as any
				),
				{ id }
			);
			return response.deleteLibrary;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.libraries });
		},
		onError: (error) => {
			console.error('Failed to delete library:', error);
		},
	});
};

export const useLikeTrack = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (trackId: string) => {
			const response = await graffleClient.request<{
				likeTrack: SimpleMusicTrack;
			}>(
				gql`
					${simpleMusicTrackFragment}
					mutation LikeTrack($trackId: ID!) {
						likeTrack(trackId: $trackId) {
							...SimpleMusicTrackFragment
						}
					}
				`,
				{ trackId }
			);
			return response.likeTrack;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tracks() });
			queryClient.invalidateQueries({
				queryKey: queryKeys.randomTrackWithStats(),
			});
		},
	});
};

export const useBangerTrack = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (trackId: string) => {
			const response = await graffleClient.request<{
				bangerTrack: SimpleMusicTrack;
			}>(
				gql`
					${simpleMusicTrackFragment}
					mutation BangerTrack($trackId: ID!) {
						bangerTrack(trackId: $trackId) {
							...SimpleMusicTrackFragment
						}
					}
				`,
				{ trackId }
			);
			return response.bangerTrack;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tracks() });
			queryClient.invalidateQueries({
				queryKey: queryKeys.randomTrackWithStats(),
			});
		},
	});
};

export const useDislikeTrack = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (trackId: string) => {
			const response = await graffleClient.request<{
				dislikeTrack: boolean;
			}>(
				gql`
					mutation DislikeTrack($trackId: ID!) {
						dislikeTrack(trackId: $trackId)
					}
				`,
				{ trackId }
			);
			return response.dislikeTrack;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tracks() });
			queryClient.invalidateQueries({
				queryKey: queryKeys.randomTrackWithStats(),
			});
		},
	});
};

// Note: playTrack mutation removed as it doesn't exist in the schema
// export const usePlayTrack = () => { ... };
