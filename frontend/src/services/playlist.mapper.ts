import { CleanArchPlaylist, PlaylistItem } from '@/__generated__/types';

/** Map CleanArchPlaylist (me.playlists.items) to legacy PlaylistItem shape */
export function toPlaylistItem(item: CleanArchPlaylist): PlaylistItem {
	const s = item.stats;
	return {
		__typename: 'PlaylistItem',
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
	};
}
