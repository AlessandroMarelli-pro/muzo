// clean-arch/adapters/graphql/mappers/track.mapper.ts
import type {
  AudioFileAIMetadata,
  AudioFileFeatures,
  AudioFileInfo,
  AudioFileMetadata,
  AudioTechnical,
  MusicTrack,
  MusicTrackStats,
} from 'src/clean-arch/kernel/types/model-types';

import type {
  Track,
  TrackAIMetadata,
  TrackFileInfo,
  TrackMetadata,
  TrackMusicalFeatures,
  TrackStats,
  TrackTechnicalInfo,
} from '../schema/track.schema';

function toTrackStats(stats: MusicTrackStats): TrackStats {
  return {
    listeningCount: stats.listeningCount,
    lastPlayedAt: stats.lastPlayedAt,
    isFavorite: stats.isFavorite,
    isLiked: stats.isLiked,
    isBanger: stats.isBanger,
  };
}

function toTrackFileInfo(fileInfo: AudioFileInfo): TrackFileInfo {
  return {
    filePath: fileInfo.filePath,
    fileName: fileInfo.fileName,
    fileSize: fileInfo.fileSize,
    fileCreatedAt: fileInfo.fileCreatedAt,
  };
}

function toTrackTechnicalInfo(
  technicalInfo: AudioTechnical,
): TrackTechnicalInfo {
  return {
    duration: technicalInfo.duration,
    format: technicalInfo.format,
  };
}

function toTrackMetadata(metadata: AudioFileMetadata): TrackMetadata {
  return {
    album: metadata.album,
    date: metadata.date,
    genres: metadata.genres?.length ? metadata.genres : undefined,
    subgenres: metadata.subgenres?.length ? metadata.subgenres : undefined,
  };
}

function toTrackAIMetadata(aiMetadata: AudioFileAIMetadata): TrackAIMetadata {
  return {
    tags: aiMetadata.tags?.length ? aiMetadata.tags : undefined,
    vocalsDesc: aiMetadata.vocalsDesc,
    description: aiMetadata.description || undefined,
    vocalsDescriptions: aiMetadata.vocalsDesc,
    atmosphereKeywords: aiMetadata.atmosphereDesc?.length
      ? aiMetadata.atmosphereDesc
      : undefined,
    contextBackgrounds: aiMetadata.contextBackground,
    contextImpacts: aiMetadata.contextImpact,
  };
}

function toTrackMusicalFeatures(
  features: AudioFileFeatures,
): TrackMusicalFeatures {
  if (!features) {
    return null;
  }
  const m = features.musicalFeatures;
  return {
    tempo: m.tempo,
    key: m.key,
    valenceMood: m.valenceMood,
    arousalMood: m.arousalMood,
    danceabilityFeeling: m.danceabilityFeeling,
    acousticness: m.acousticness,
    instrumentalness: m.instrumentalness,
    speechiness: m.speechiness,
  };
}

/**
 * Maps kernel MusicTrack (domain) to GraphQL Track (adapter DTO).
 * Keeps the adapter as a pure translation layer: schema never imports domain entities.
 */
export function toTrack(domain: MusicTrack): Track {
  return {
    id: domain.id,
    artist: domain.artist,
    title: domain.title,
    stats: toTrackStats(domain.stats),
    fileInfo: toTrackFileInfo(domain.fileInfo),
    technicalInfo: toTrackTechnicalInfo(domain.technicalInfo),
    metadata: toTrackMetadata(domain.metadata),
    aiMetadata: toTrackAIMetadata(domain.aiMetadata),
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    musicalFeatures: toTrackMusicalFeatures(domain.features),
    imagePath: domain.imagePath,
    lastScannedAt: domain.analysisInfo.completedAt,
    libraryId: domain.libraryId,
  };
}

/** Batch variant for list endpoints */
export function toTracks(domains: MusicTrack[]): Track[] {
  return domains.map((d) => toTrack(d));
}
