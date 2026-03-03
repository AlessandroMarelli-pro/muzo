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
import type { Track } from '../schema/track.schema';

function toTrackStats(stats: MaybeUndefined<MusicTrackStats>) {
  if (!stats) {
    return {
      listeningCount: 0,
      lastPlayedAt: undefined,
      isFavorite: false,
      isLiked: false,
      isBanger: false,
    };
  }
  return {
    listeningCount: stats.listeningCount,
    lastPlayedAt: stats.lastPlayedAt,
    isFavorite: stats.isFavorite,
    isLiked: stats.isLiked,
    isBanger: stats.isBanger,
  };
}

function toTrackFileInfo(fileInfo: MaybeUndefined<AudioFileInfo>) {
  if (!fileInfo) {
    return {
      filePath: '',
      fileName: '',
      fileSize: 0,
      fileCreatedAt: new Date(),
    };
  }
  return {
    filePath: fileInfo.filePath,
    fileName: fileInfo.fileName,
    fileSize: fileInfo.fileSize,
    fileCreatedAt: fileInfo.fileCreatedAt,
  };
}

function toTrackTechnicalInfo(technicalInfo: MaybeUndefined<AudioTechnical>) {
  if (!technicalInfo) {
    return {
      duration: 0,
      format: '',
    };
  }
  return {
    duration: technicalInfo.duration ?? 0,
    format: technicalInfo.format,
  };
}

function toTrackMetadata(metadata: MaybeUndefined<AudioFileMetadata>) {
  if (!metadata) {
    return {
      date: undefined,
      genres: [],
      subgenres: [],
    };
  }
  return {
    date: metadata.date,
    genres: metadata.genres?.length ? metadata.genres : undefined,
    subgenres: metadata.subgenres?.length ? metadata.subgenres : undefined,
  };
}

function toTrackAIMetadata(aiMetadata: MaybeUndefined<AudioFileAIMetadata>) {
  if (!aiMetadata) {
    return {
      aiTags: [],
      aiVocalsDesc: '',
      aiDescription: '',
      aiVocalsDescriptions: '',
      aiAtmosphereKeywords: [],
      aiContextBackgrounds: '',
      aiContextImpacts: '',
    };
  }
  return {
    aiTags: aiMetadata.tags?.length ? aiMetadata.tags : undefined,
    aiVocalsDesc: aiMetadata.vocalsDesc,
    aiDescription: aiMetadata.description || undefined,
    aiVocalsDescriptions: aiMetadata.vocalsDesc,
    aiAtmosphereKeywords: aiMetadata.atmosphereTags?.length
      ? aiMetadata.atmosphereTags
      : [],
    aiContextBackgrounds: aiMetadata.contextBackground,
    aiContextImpacts: aiMetadata.contextImpact,
  };
}

function toTrackMusicalFeatures(features: MaybeUndefined<AudioFileFeatures>) {
  if (!features?.musicalFeatures) {
    return {
      mfTempo: 0,
      mfKey: '',
      mfValenceMood: '',
      mfArousalMood: '',
      mfDanceabilityFeeling: '',
    };
  }
  const m = features.musicalFeatures;
  return {
    mfTempo: m.tempo,
    mfKey: m.key,
    mfValenceMood: m.valenceMood,
    mfArousalMood: m.arousalMood,
    mfDanceabilityFeeling: m.danceabilityFeeling,
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
    ...toTrackStats(domain.stats),
    ...toTrackFileInfo(domain.fileInfo),
    ...toTrackTechnicalInfo(domain.technicalInfo),
    ...toTrackMetadata(domain.metadata),
    ...toTrackAIMetadata(domain.aiMetadata),
    ...toTrackMusicalFeatures(domain.features),
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    imagePath: domain.imagePath,
    lastScannedAt: domain.analysisInfo?.completedAt,
    libraryId: domain.libraryId,
    analysisStatus: domain.analysisInfo?.status,
  };
}

/** Batch variant for list endpoints */
export function toTracks(domains: MusicTrack[]): MaybeUndefined<Track>[] {
  return domains.map((d) => toTrack(d));
}
