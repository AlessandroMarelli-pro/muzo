import {
	CleanArchPlaylist,
	Playlist,
	PlaylistTrack,
} from '@/__generated__/types';

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
		track: {
			__typename: 'SimpleMusicTrack',
			id: track.track.id,
			artist: track.track.artist,
			title: track.track.title,
			duration: track.track.duration,
			date: track.track.date,
			isFavorite: track.track.isFavorite,
			isLiked: track.track.isLiked,
			isBanger: track.track.isBanger,
			createdAt: track.track.createdAt,
			updatedAt: track.track.updatedAt,
			tempo: track.track.tempo,
			key: track.track.key,
			valenceMood: track.track.valenceMood,
			arousalMood: track.track.arousalMood,
		},
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
	};
}
