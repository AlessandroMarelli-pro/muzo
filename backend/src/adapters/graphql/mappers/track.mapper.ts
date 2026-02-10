import type {
  AudioFileAIMetadata,
  AudioFileFeatures,
  AudioFileInfo,
  AudioFileMetadata,
  AudioTechnical,
  MusicTrack,
  MusicTrackStats,
} from 'src/kernel/types/model-types';

import { MaybeUndefined } from 'src/kernel/common';
import type {
  Track,
  TrackAIMetadata,
  TrackFileInfo,
  TrackMetadata,
  TrackMusicalFeatures,
  TrackStats,
  TrackTechnicalInfo,
} from '../schema/track.schema';

function toTrackStats(
  stats: MaybeUndefined<MusicTrackStats>,
): MaybeUndefined<TrackStats> {
  if (!stats) {
    return undefined;
  }
  return {
    listeningCount: stats.listeningCount,
    lastPlayedAt: stats.lastPlayedAt,
    isFavorite: stats.isFavorite,
    isLiked: stats.isLiked,
    isBanger: stats.isBanger,
  };
}

function toTrackFileInfo(
  fileInfo: MaybeUndefined<AudioFileInfo>,
): MaybeUndefined<TrackFileInfo> {
  if (!fileInfo) {
    return undefined;
  }
  return {
    filePath: fileInfo.filePath,
    fileName: fileInfo.fileName,
    fileSize: fileInfo.fileSize,
    fileCreatedAt: fileInfo.fileCreatedAt,
  };
}

function toTrackTechnicalInfo(
  technicalInfo: MaybeUndefined<AudioTechnical>,
): MaybeUndefined<TrackTechnicalInfo> {
  if (!technicalInfo) {
    return undefined;
  }
  return {
    duration: technicalInfo.duration ?? 0,
    format: technicalInfo.format,
  };
}

function toTrackMetadata(
  metadata: MaybeUndefined<AudioFileMetadata>,
): MaybeUndefined<TrackMetadata> {
  if (!metadata) {
    return undefined;
  }
  return {
    album: metadata.album,
    date: metadata.date,
    genres: metadata.genres?.length ? metadata.genres : undefined,
    subgenres: metadata.subgenres?.length ? metadata.subgenres : undefined,
  };
}

function toTrackAIMetadata(
  aiMetadata: MaybeUndefined<AudioFileAIMetadata>,
): MaybeUndefined<TrackAIMetadata> {
  if (!aiMetadata) {
    return undefined;
  }
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
  features: MaybeUndefined<AudioFileFeatures>,
): MaybeUndefined<TrackMusicalFeatures> {
  if (!features?.musicalFeatures) {
    return undefined;
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
    lastScannedAt: domain.analysisInfo?.completedAt,
    libraryId: domain.libraryId,
  };
}

/** Batch variant for list endpoints */
export function toTracks(domains: MusicTrack[]): MaybeUndefined<Track>[] {
  return domains.map((d) => toTrack(d));
}
