import {
	queryOptions,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { parse } from 'graphql';
import type {
	CreateLibraryInput,
	CursorPaginatedTracks,
	CursorPaginationArgs,
	GetRecentlyPlayedQuery,
	Library,
	PaginatedTracks,
	RandomTrackWithStats,
	StaticFilterOptions,
	Track,
	TrackRecommendation,
} from '../__generated__/types';
import { libraryFragment, trackFragment } from './fragments';
import { gql, graffleClient } from './graffle-client';
import { simpleMusicTrackFragment } from './playlist-hooks';
import { toTrack } from './track.mapper';

// Define AnalysisStatus enum locally since it's not in the generated types
export type AnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Define LibraryScanStatus enum locally since it's not in the generated types
export type LibraryScanStatus =
	| 'IDLE'
	| 'SCANNING'
	| 'ANALYZING'
	| 'PAUSED'
	| 'ERROR';

// Query Keys
export const queryKeys = {
	libraries: ['libraries'] as const,
	library: (id: string) => ['libraries', id] as const,
	tracks: (pagination: CursorPaginationArgs) =>
		['tracks', { pagination }] as const,
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
		me: { libraries: Library[] };
	}>(gql`
		${libraryFragment}
		query GetLibraries {
			me {
				libraries {
					...LibraryFragment
				}
			}
		}
	`);
	return response.me.libraries;
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
			const response = await graffleClient.request<{
				node: Library;
			}>({
				document: parse(gql`
					${libraryFragment}
					query GetLibrary($id: Base64ID!) {
						node(id: $id) {
							... on Library {
								...LibraryFragment
							}
						}
					}
				`),
				variables: { id },
			});
			return response.node;
		},
		enabled: !!id,
	});
};

// Track Queries
export const useTracks = ({
	pagination,
}: {
	pagination: CursorPaginationArgs;
}) => {
	return useInfiniteQuery({
		queryKey: queryKeys.tracks(pagination),
		queryFn: async () => {
			const response = await graffleClient.request<{
				me: { tracks: CursorPaginatedTracks };
			}>(
				gql`
					${trackFragment}
					query GetTracks($pagination: CursorPaginationArgs!) {
						me {
							tracks(pagination: $pagination) {
								hasMore
								nextCursor
								items {
									...TrackFragment
								}
							}
						}
					}
				`,
				{
					pagination,
				}
			);
			return {
				...response.me.tracks,
				tracks: response.me.tracks.items?.map(toTrack),
			};
		},
		initialPageParam: 0,
		getPreviousPageParam: (firstPage) => firstPage.nextCursor,
		getNextPageParam: (lastPage) => lastPage.nextCursor,
	});
};

export const fetchRandomTrack = async (id?: string, filterLiked?: boolean) => {
	const response = await graffleClient.request<{
		node: Track;
	}>(
		gql`
			${trackFragment}
			query GetRandomTrack($id: Base64ID!) {
				node(id: $id) {
					... on Track {
						...TrackFragment
					}
				}
			}
		`,
		{ id, filterLiked }
	);
	return toTrack(response.node);
};

export const useRandomTrack = (id?: string, filterLiked?: boolean) => {
	return useQuery({
		queryKey: queryKeys.randomTrack(id, filterLiked),
		queryFn: async () => fetchRandomTrack(id, filterLiked),
	});
};

export const fetchRandomTrackWithStats = async () => {
	const response = await graffleClient.request<{
		me: { randomTrackWithStats: RandomTrackWithStats };
	}>(gql`
		${trackFragment}
		query GetRandomTrackWithStats {
			me {
				randomTrackWithStats {
					track {
						...TrackFragment
					}
					likedCount
					bangerCount
					dislikedCount
					remainingCount
				}
			}
		}
	`);
	const randomTrackWithStats = response.me.randomTrackWithStats;
	const track = randomTrackWithStats.track
		? toTrack(randomTrackWithStats.track)
		: null;
	return {
		...randomTrackWithStats,
		track,
	};
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
		node: { recommendations: TrackRecommendation[] };
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
	return response.node.recommendations.map((recommendation) => ({
		__typename: 'TrackRecommendation',
		track: toTrack(recommendation.track),
		similarity: recommendation.similarity,
		reasons: recommendation.reasons,
	}));
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
				me: { paginatedTracks: PaginatedTracks };
			}>(
				gql`
					${trackFragment}
					query GetTracksList($pagination: PaginationArgs) {
						me {
							paginatedTracks(pagination: $pagination) {
								items {
									...TrackFragment
								}
								total
								page
								limit
								pages
							}
						}
					}
				`,
				{
					pagination: {
						limit,
						offset,
						orderBy,
						orderDirection,
					},
				}
			);
			return response.me.paginatedTracks;
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
				createLibrary: Library;
			}>(
				parse(
					` ${libraryFragment}
          mutation CreateLibrary($input: CreateLibraryInput!) {
            createLibrary(input: $input) {
              ...LibraryFragment
            }
          }
        `
				),
				{ input }
			);
			return response.createLibrary;
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: librariesQueryOptions().queryKey,
			});
			// Ensure the playlists query has refetched and cache is updated
			await queryClient.refetchQueries({
				queryKey: librariesQueryOptions().queryKey,
			});
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
          mutation DeleteLibrary($id: Base64ID!) {
            deleteLibrary(id: $id)
          }
        ` as any
				),
				{ id }
			);
			return response.deleteLibrary;
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: librariesQueryOptions().queryKey,
			});
			await queryClient.refetchQueries({
				queryKey: librariesQueryOptions().queryKey,
			});
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
				toggleLike: Track;
			}>(
				gql`
					${trackFragment}
					mutation LikeTrack($trackId: Base64ID!) {
						toggleLike(trackId: $trackId) {
							...TrackFragment
						}
					}
				`,
				{ trackId }
			);
			return toTrack(response.toggleLike);
		},
		onSuccess: () => {
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
				toggleBanger: Track;
			}>(
				gql`
					${trackFragment}
					mutation BangerTrack($trackId: Base64ID!) {
						toggleBanger(trackId: $trackId) {
							...TrackFragment
						}
					}
				`,
				{ trackId }
			);
			return toTrack(response.toggleBanger);
		},
		onSuccess: () => {
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
				toggleDislike: boolean;
			}>(
				gql`
					mutation ToggleDislike($trackId: Base64ID!) {
						toggleDislike(trackId: $trackId)
					}
				`,
				{ trackId }
			);
			return response.toggleDislike;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.randomTrackWithStats(),
			});
		},
	});
};

// Note: playTrack mutation removed as it doesn't exist in the schema
// export const usePlayTrack = () => { ... };
