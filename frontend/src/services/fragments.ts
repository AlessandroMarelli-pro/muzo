import { gql } from './graffle-client';

export const trackFragment = gql`
  fragment TrackFragment on Track {
    id
    artist
    title
    listeningCount
    lastPlayedAt
    isFavorite
    isLiked
    isBanger
    filePath
    fileName
    fileCreatedAt
    fileSize
    hqAudioPath
    duration
    genres
    subgenres
    aiTags
    aiVocalsDesc
    aiDescription
    aiVocalsDescriptions
    aiAtmosphereKeywords
    aiContextBackgrounds
    aiContextImpacts
    createdAt
    updatedAt
    mfTempo
    mfKey
    mfCamelotKey
    mfValenceMood
    mfArousalMood
    mfDanceabilityFeeling
    mfDanceability
    mfInstrumentalness
    mfVoice
    mfMoodHappy
    mfMoodSad
    mfMoodRelaxed
    mfMoodAggressive
    mfMoodParty

    imagePath
    lastScannedAt
    libraryId
    analysisStatus
    date
    format
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
    stats {
      bpmRange {
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
      instrumentalness {
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
