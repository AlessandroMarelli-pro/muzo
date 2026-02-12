import {
  AudioFingerprint as PrismaAudioFingerprint,
  Genre as PrismaGenre,
  ImageSearch as PrismaImageSearch,
  MusicTrack as PrismaMusicTrack,
  Subgenre as PrismaSubgenre,
  TrackGenre as PrismaTrackGenre,
  TrackSubgenre as PrismaTrackSubgenre,
} from '@prisma/client';

import { MusicTrackUpdateData } from 'src/application/ports/repositories/IMusicTrackRepository';
import { Maybe, MaybeUndefined } from 'src/kernel/common';
import { MusicTrackId } from 'src/kernel/ids';
import { extractModelId } from 'src/kernel/ids/factory';
import {
  AggregationStatistics,
  AudioFileAIMetadata,
  AudioFileAnalysis,
  AudioFileAnalysisStatusEnum,
  AudioFileFeatures,
  AudioFileInfo,
  AudioFileMetadata,
  AudioTechnical,
  MelodicFeatures,
  MusicTrack,
  MusicTrackStats,
} from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDbModel } from '../db';
import { toDomainModel } from '../domain';

export type PrismaMusicTrackWithRelations = PrismaMusicTrack & {
  audioFingerprint?: Maybe<PrismaAudioFingerprint>;
  trackGenres?: Maybe<(PrismaTrackGenre & { genre: PrismaGenre })[]>;
  trackSubgenres?: Maybe<
    (PrismaTrackSubgenre & { subgenre: PrismaSubgenre })[]
  >;
  imageSearches?: Maybe<PrismaImageSearch[]>;
};

export type ToDomain = (row: PrismaMusicTrackWithRelations) => MusicTrack;

export type ToMusicTrackStats = (
  row: PrismaMusicTrack,
) => MaybeUndefined<MusicTrackStats>;

export type ToAudioFileInfo = (row: PrismaMusicTrack) => AudioFileInfo;
export type ToAudioTechnical = (
  row: PrismaMusicTrack,
) => MaybeUndefined<AudioTechnical>;
export type ToAudioFileFeatures = (
  row?: Maybe<PrismaAudioFingerprint>,
) => MaybeUndefined<AudioFileFeatures>;
export type ToAudioFileMetadata = (
  row: PrismaMusicTrackWithRelations,
) => MaybeUndefined<AudioFileMetadata>;
export type ToAudioFileAIMetadata = (
  row: PrismaMusicTrack,
) => MaybeUndefined<AudioFileAIMetadata>;
export type ToImagePath = (
  row: PrismaMusicTrackWithRelations,
) => MaybeUndefined<string>;
export type ToAudioFileAnalysis = (
  row: PrismaMusicTrack,
) => MaybeUndefined<AudioFileAnalysis>;

export const toMusicTrackStats: ToMusicTrackStats = (row) => {
  if (!row) return undefined;
  return {
    listeningCount: row.listeningCount || 0,
    lastPlayedAt: row.lastPlayedAt ?? undefined,
    isFavorite: row.isFavorite ?? false,
    isLiked: row.isLiked ?? false,
    isBanger: row.isBanger ?? false,
  };
};

export const toAudioFileInfo: ToAudioFileInfo = (row) => {
  return {
    filePath: row.filePath,
    fileName: row.fileName,
    fileSize: row.fileSize,
    fileCreatedAt: row.fileCreatedAt,
  };
};

export const toAudioTechnical: ToAudioTechnical = (row) => {
  if (!row) return undefined;
  return {
    duration: row.duration ?? undefined,
    format: row.format,
    bitrate: row.bitrate ?? undefined,
    sampleRate: row.sampleRate ?? undefined,
  };
};

export const toAggregationStatistics = (row: string): AggregationStatistics => {
  if (!row)
    return {
      mean: 0,
      std: 0,
      median: 0,
      min: 0,
      max: 0,
      p25: 0,
      p75: 0,
    };
  return JSON.parse(row) as AggregationStatistics;
};

export const toAudioFileFeatures: ToAudioFileFeatures = (row) => {
  if (!row) return undefined;
  return {
    spectralFeatures: {
      spectralCentroid: toAggregationStatistics(row.spectralCentroid),
      spectralRolloff: toAggregationStatistics(row.spectralRolloff),
      spectralSpread: toAggregationStatistics(row.spectralSpread),
      spectralBandwith: toAggregationStatistics(row.spectralBandwith),
      spectralFlatness: toAggregationStatistics(row.spectralFlatness),
      spectralContrast: toAggregationStatistics(row.spectralContrast),
      chroma: toAggregationStatistics(row.chroma),
      tonnetz: toAggregationStatistics(row.tonnetz),
      zeroCrossingRate: toAggregationStatistics(row.zeroCrossingRate),
      rms: toAggregationStatistics(row.rms),
      mfcc: JSON.parse(row.mfcc) as number[],
    },
    melodicFeatures: {
      chroma: JSON.parse(row.chroma) as MelodicFeatures & {
        dominant_pitch: number;
      },
      tonnetz: JSON.parse(row.tonnetz) as MelodicFeatures,
    },
    fingerprint: {
      audioHash: row.audioHash,
      fileHash: row.fileHash,
    },
    musicalFeatures: {
      calculationFeatures: {
        rhythmStability: row.rhythmStability,
        bassPresence: row.bassPresence,
        tempoRegularity: row.tempoRegularity,
        tempoAppropriateness: row.tempoAppropriateness,
        energyFactor: row.energyFactor,
        syncopation: row.syncopation,
        modeFactor: row.modeFactor,
        modeConfidence: row.modeConfidence,
        modeWeight: row.modeWeight,
        tempoFactor: row.tempoFactor,
        brightnessFactor: row.brightnessFactor,
        harmonicFactor: row.harmonicFactor,
        spectralBalance: row.spectralBalance,
        beatStrength: row.beatStrength,
        energyComment: row.energyComment,
        energyKeywords: row.energyKeywords.split(','),
        energyByBand: JSON.parse(row.energyByBand),
      },
      camelotKey: row.camelotKey,
      energy: row.energyFactor,
      energyComment: row.energyComment,
      energyKeywords: row.energyKeywords.split(','),
      tempo: row.tempo,
      key: row.key,
      valence: row.valence,
      valenceMood: row.valenceMood,
      arousal: row.arousal,
      arousalMood: row.arousalMood,
      danceability: row.danceability,
      danceabilityFeeling: row.danceabilityFeeling,
      acousticness: row.acousticness,
      instrumentalness: row.instrumentalness,
      speechiness: row.speechiness,
      liveness: row.liveness,
    },
  };
};

export const toAudioFileMetadata: ToAudioFileMetadata = (row) => {
  if (!row) return undefined;
  return {
    album: row.aiAlbum ?? undefined,
    duration: row.duration ?? undefined,
    date: row.originalDate ?? undefined,
    genres: row.trackGenres?.map((genre) => genre.genre.name) || [],
    subgenres:
      row.trackSubgenres?.map((subgenre) => subgenre.subgenre.name) || [],
  };
};

export const toAudioFileAIMetadata: ToAudioFileAIMetadata = (row) => {
  if (!row) return undefined;
  return {
    description: row.aiDescription ?? undefined,
    tags: JSON.parse(row.aiTags ?? '[]'),
    vocalsDesc: row.vocalsDesc ?? undefined,
    atmosphereDesc: row.atmosphereDesc ? JSON.parse(row.atmosphereDesc) : [],
    contextBackground: row.contextBackground ?? undefined,
    contextImpact: row.contextImpact ?? undefined,
  };
};

export const toAudioFileAnalysis: ToAudioFileAnalysis = (row) => {
  if (!row) return undefined;
  return {
    status: row.analysisStatus as MaybeUndefined<AudioFileAnalysisStatusEnum>,
    startedAt: row.analysisStartedAt ?? undefined,
    completedAt: row.analysisCompletedAt ?? undefined,
    error: row.analysisError ?? undefined,
  };
};

export const toMusicTrackId = (row: PrismaMusicTrack): MusicTrackId => {
  return models.musicTrack.id(row.id);
};

export const toImagePath: ToImagePath = (row) => {
  if (!row) return undefined;
  return row.imageSearches?.[0]?.imagePath ?? undefined;
};

export const toDomain: ToDomain = (row) => {
  return {
    id: toMusicTrackId(row),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt ?? undefined,
      updatedById: row.updatedById ?? undefined,
    }),
    libraryId: models.musicLibrary.id(row.libraryId),
    title: row.originalTitle ?? undefined,
    artist: row.originalArtist ?? undefined,
    stats: toMusicTrackStats(row),
    fileInfo: toAudioFileInfo(row),
    technicalInfo: toAudioTechnical(row),
    features: toAudioFileFeatures(row.audioFingerprint),
    metadata: toAudioFileMetadata(row),
    aiMetadata: toAudioFileAIMetadata(row),
    analysisInfo: toAudioFileAnalysis(row),
    imagePath: toImagePath(row),
  };
};

export type ToPrisma = (domainModel: MusicTrack) => PrismaMusicTrack;

export const toPrisma: ToPrisma = (domainModel) => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    originalTitle: domainModel.title ?? null,
    originalArtist: domainModel.artist ?? null,
    duration: domainModel.technicalInfo?.duration ?? 0,
    originalDate: domainModel.metadata?.date ?? null,
    isFavorite: domainModel.stats?.isFavorite ?? false,
    isLiked: domainModel.stats?.isLiked ?? false,
    isBanger: domainModel.stats?.isBanger ?? false,
    analysisStatus: domainModel.analysisInfo?.status ?? 'PENDING',
    analysisStartedAt: domainModel.analysisInfo?.startedAt ?? null,
    analysisCompletedAt: domainModel.analysisInfo?.completedAt ?? null,
    analysisError: domainModel.analysisInfo?.error ?? null,
    hasMusicbrainz: false,
    hasDiscogs: false,
    libraryId: extractModelId(domainModel.libraryId).dbId,
    filePath: domainModel.fileInfo?.filePath,
    fileName: domainModel.fileInfo?.fileName ?? null,
    fileSize: domainModel.fileInfo?.fileSize ?? null,
    format: domainModel.technicalInfo?.format ?? '',
    bitrate: domainModel.technicalInfo?.bitrate ?? null,
    sampleRate: domainModel.technicalInfo?.sampleRate ?? null,
    fileCreatedAt: domainModel.fileInfo?.fileCreatedAt ?? null,
    originalAlbum: domainModel.metadata?.album ?? null,
    originalYear: domainModel.metadata?.date?.getFullYear() ?? null,
    originalAlbumartist: domainModel.artist ?? null,
    originalBpm: domainModel.features?.musicalFeatures?.tempo ?? null,
    originalTrack_number: 0,
    originalDisc_number: '0',
    originalComment: '',
    originalComposer: '',
    originalCopyright: '',
    aiTitle: domainModel.title ?? null,
    aiArtist: domainModel.artist ?? null,
    aiAlbum: domainModel.metadata?.album ?? null,
    aiConfidence: 0,
    aiSubgenreConfidence: 0,
    aiDescription: domainModel.aiMetadata?.description ?? null,
    aiTags: domainModel.aiMetadata?.tags?.join(',') ?? null,
    vocalsDesc: domainModel.aiMetadata?.vocalsDesc ?? null,
    atmosphereDesc: domainModel.aiMetadata?.atmosphereDesc?.join(',') ?? null,
    contextBackground: domainModel.aiMetadata?.contextBackground ?? null,
    contextImpact: domainModel.aiMetadata?.contextImpact ?? null,
    userTitle: domainModel.title ?? null,
    userArtist: domainModel.artist ?? null,
    userAlbum: domainModel.metadata?.album ?? null,
    userTags: domainModel.aiMetadata?.tags?.join(',') ?? null,
    listeningCount: domainModel.stats?.listeningCount ?? 0,
    lastPlayedAt: domainModel.stats?.lastPlayedAt ?? null,
  };
};

export type ToPrismaUpdate = (
  data: MusicTrackUpdateData,
) => Partial<PrismaMusicTrack>;

export const toPrismaUpdate: ToPrismaUpdate = (data) => {
  const stats = data.stats ?? undefined;
  return {
    isLiked: stats?.isLiked ?? undefined,
    isBanger: stats?.isBanger ?? undefined,
    isFavorite: stats?.isFavorite ?? undefined,
    analysisStatus: data.analysisStatus ?? undefined,
    analysisStartedAt: data.analysisStartedAt ?? undefined,
    duration: data.duration ?? undefined,
    format: data.format ?? undefined,
    fileCreatedAt: data.fileCreatedAt ?? undefined,
    filePath: data.filePath ?? undefined,
    fileName: data.fileName ?? undefined,
    fileSize: data.fileSize ?? undefined,
  };
};
