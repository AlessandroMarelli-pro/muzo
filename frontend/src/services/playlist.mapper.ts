import {
	CleanArchPlaylist,
	Playlist,
	PlaylistTrack,
} from '@/__generated__/types';
import { toTrack } from './track.mapper';

/** Map CleanArchPlaylist (me.playlists.items) to legacy PlaylistItem shape */
export function toPlaylistItem(item: CleanArchPlaylist): Playlist {
	const s = item.stats;
	const tracks = item.tracks?.map((track) => ({
		__typename: 'PlaylistTrack',
		id: track.id,
		position: track.position,
		addedAt: track.addedAt,
		playlistId: track.playlistId,
		trackId: track.trackId,
		track: track?.track ? toTrack(track.track) : undefined,
	}));
	return {
		__typename: 'Playlist',
		id: item.id,
		name: item.name,
		description: item.description ?? undefined,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
		bpmRange: s?.bpmRange ?? { __typename: 'Range', min: 0, max: 0 },
		energyRange: s?.energyRange ?? { __typename: 'Range', min: 0, max: 0 },
		genresCount: s?.genresCount ?? 0,
		subgenresCount: s?.subgenresCount ?? 0,
		topGenres: s?.topGenres ?? [],
		topSubgenres: s?.topSubgenres ?? [],
		numberOfTracks: s?.numberOfTracks ?? 0,
		totalDuration: s?.totalDuration ?? 0,
		images: s?.images ?? [],
		isTrackInPlaylist: item.containsTrack ?? false,
		tracks: tracks as PlaylistTrack[],
		sorting: item.sorting
			? {
					__typename: 'PlaylistSorting',
					id: item.sorting.id,
					playlistId: item.sorting.playlistId,
					sortingKey: item.sorting.sortingKey,
					sortingDirection: item.sorting.sortingDirection,
					createdAt: item.sorting.createdAt,
					updatedAt: item.sorting.updatedAt,
				}
			: undefined,
	};
}
