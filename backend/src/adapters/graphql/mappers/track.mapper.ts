import type {
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

function toTrackMusicalFeatures(features: MaybeUndefined<AudioFileFeatures>) {
  if (!features?.musicalFeatures) {
    return {
      mfTempo: undefined,
      mfKey: undefined,
      mfCamelotKey: undefined,
      mfValenceMood: undefined,
      mfArousalMood: undefined,
      mfDanceabilityFeeling: undefined,
      mfDanceability: undefined,
      mfInstrumentalness: undefined,
      mfVoice: undefined,
      mfMoodHappy: undefined,
      mfMoodSad: undefined,
      mfMoodRelaxed: undefined,
      mfMoodAggressive: undefined,
      mfMoodParty: undefined,
    };
  }
  const m = features.musicalFeatures;
  return {
    mfTempo: m.tempo,
    mfKey: m.key,
    mfCamelotKey: m.camelotKey,
    mfValenceMood: m.valenceMood,
    mfArousalMood: m.arousalMood,
    mfDanceabilityFeeling: m.danceabilityFeeling,
    mfDanceability: m.danceability,
    mfInstrumentalness: m.instrumentalness,
    mfVoice: m.voice,
    mfMoodHappy: m.moodHappy,
    mfMoodSad: m.moodSad,
    mfMoodRelaxed: m.moodRelaxed,
    mfMoodAggressive: m.moodAggressive,
    mfMoodParty: m.moodParty,
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
    hqAudioPath: domain.hqAudioPath,
    hqAudioSource: domain.hqAudioSource,
    hqAudioVerified: domain.hqAudioVerified,
    hqAudioSpectralCutoffHz: domain.hqAudioSpectralCutoffHz,
    ...toTrackTechnicalInfo(domain.technicalInfo),
    ...toTrackMetadata(domain.metadata),
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
