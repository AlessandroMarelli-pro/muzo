import { SimpleMusicTrack, Track } from '@/__generated__/types';

export function toTrack(track: Track): SimpleMusicTrack {
	return {
		__typename: 'SimpleMusicTrack',
		id: track.id,
		artist: track.artist,
		title: track.title,
		duration: track.technicalInfo.duration,
		date: track.metadata.date,
		isFavorite: track.stats.isFavorite,
		isLiked: track.stats.isLiked,
		isBanger: track.stats.isBanger,
		createdAt: track.createdAt,
		updatedAt: track.updatedAt,
		tempo: track.musicalFeatures.tempo,
		key: track.musicalFeatures.key,
		valenceMood: track.musicalFeatures.valenceMood,
		arousalMood: track.musicalFeatures.arousalMood,
		imagePath: track.imagePath,
		lastScannedAt: track.lastScannedAt,
		libraryId: track.libraryId,
		genres: track.metadata.genres,
		subgenres: track.metadata.subgenres,
		description: track.aiMetadata.description,
		tags: track.aiMetadata.tags,
		vocalsDescriptions: track.aiMetadata.vocalsDescriptions,
		atmosphereKeywords: track.aiMetadata.atmosphereKeywords,
		contextBackgrounds: track.aiMetadata.contextBackgrounds,
		contextImpacts: track.aiMetadata.contextImpacts,
		fileCreatedAt: track.fileInfo.fileCreatedAt,
	};
}
