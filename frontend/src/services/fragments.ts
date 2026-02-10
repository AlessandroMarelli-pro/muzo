import { gql } from './graffle-client';

export const trackFragment = gql`
	fragment TrackFragment on Track {
		id
		artist
		title
		stats {
			listeningCount
			lastPlayedAt
			isFavorite
			isLiked
			isBanger
		}
		fileInfo {
			filePath
			fileName
			fileSize
			fileCreatedAt
		}
		technicalInfo {
			duration
			format
		}
		metadata {
			album
			date
			genres
			subgenres
		}
		aiMetadata {
			tags
			vocalsDesc
			description
			vocalsDescriptions
			atmosphereKeywords
			contextBackgrounds
			contextImpacts
		}
		createdAt
		updatedAt
		musicalFeatures {
			tempo
			key
			valenceMood
			arousalMood
			danceabilityFeeling
			acousticness
			instrumentalness
			speechiness
		}
		imagePath
		lastScannedAt
		libraryId
	}
`;

export const playlistTrackFragment = gql`
	${trackFragment}
	fragment PlaylistTrackFragment on PlaylistTrack {
		id
		position
		addedAt
		track {
			...TrackFragment
		}
	}
`;

export const playlistFragment = gql`
	${playlistTrackFragment}
	fragment PlaylistFragment on Playlist {
		id
		name
		description
		isPublic
		createdAt
		updatedAt
		createdById
		updatedById
		stats {
			bpmRange {
				min
				max
			}
			energyRange {
				min
				max
			}
			genresCount
			numberOfTracks
			subgenresCount
			topGenres
			topSubgenres
			totalDuration
			images
		}
		sorting {
			id
			playlistId
			sortingKey
			sortingDirection
			createdAt
			updatedAt
		}
		tracks {
			...PlaylistTrackFragment
		}
	}
`;

export const filterFragment = gql`
	fragment FilterFragment on FilterCriteriaResult {
		id
		name
		criteria {
			valenceMood
			arousalMood
			danceabilityFeeling
			genreIds
			keyIds
			subgenreIds
			tempo {
				max
				min
			}
			speechiness {
				max
				min
			}
			instrumentalness {
				max
				min
			}
			liveness {
				max
				min
			}
			acousticness {
				max
				min
			}
			artist
			title
			libraryIds
			atmosphereIds
		}
	}
`;

export const libraryFragment = gql`
	fragment LibraryFragment on Library {
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
			includeSubdirectories
			supportedFormats
			maxFileSize
			scanInterval
		}
		createdAt
		updatedAt
	}
`;
