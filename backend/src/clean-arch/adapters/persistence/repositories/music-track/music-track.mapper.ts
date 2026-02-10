import {
  AudioFingerprint as PrismaAudioFingerprint,
  Genre as PrismaGenre,
  ImageSearch as PrismaImageSearch,
  MusicTrack as PrismaMusicTrack,
  Subgenre as PrismaSubgenre,
  TrackGenre as PrismaTrackGenre,
  TrackSubgenre as PrismaTrackSubgenre,
} from '@prisma/client';

import { MusicTrackUpdateData } from 'src/clean-arch/application/ports/repositories/IMusicTrackRepository';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
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
} from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
import { toDbModel } from '../db';
import { toDomainModel } from '../domain';

export type PrismaMusicTrackWithRelations = PrismaMusicTrack & {
  audioFingerprint: PrismaAudioFingerprint;
  trackGenres?: (PrismaTrackGenre & { genre: PrismaGenre })[];
  trackSubgenres?: (PrismaTrackSubgenre & { subgenre: PrismaSubgenre })[];
  imageSearches?: PrismaImageSearch[];
};

export type ToDomain = (row: PrismaMusicTrackWithRelations) => MusicTrack;
export type ToMusicTrackStats = (row: PrismaMusicTrack) => MusicTrackStats;
export type ToAudioFileInfo = (row: PrismaMusicTrack) => AudioFileInfo;
export type ToAudioTechnical = (row: PrismaMusicTrack) => AudioTechnical;
export type ToAudioFileFeatures = (
  row: PrismaAudioFingerprint,
) => AudioFileFeatures;
export type ToAudioFileMetadata = (
  row: PrismaMusicTrackWithRelations,
) => AudioFileMetadata;
export type ToAudioFileAIMetadata = (
  row: PrismaMusicTrack,
) => AudioFileAIMetadata;
export type ToImagePath = (row: PrismaMusicTrackWithRelations) => string;
export type ToAudioFileAnalysis = (row: PrismaMusicTrack) => AudioFileAnalysis;

export const toMusicTrackStats: ToMusicTrackStats = (row) => {
  if (!row) return null;
  return {
    listeningCount: row.listeningCount,
    lastPlayedAt: row.lastPlayedAt,
    isFavorite: row.isFavorite,
    isLiked: row.isLiked,
    isBanger: row.isBanger,
  };
};
export const toAudioFileInfo: ToAudioFileInfo = (row) => {
  if (!row) return null;
  return {
    filePath: row.filePath,
    fileName: row.fileName,
    fileSize: row.fileSize,
    fileCreatedAt: row.fileCreatedAt,
  };
};
export const toAudioTechnical: ToAudioTechnical = (row) => {
  if (!row) return null;
  return {
    duration: row.duration,
    format: row.format,
    bitrate: row.bitrate,
    sampleRate: row.sampleRate,
  };
};

export const toAggregationStatistics = (row: string): AggregationStatistics => {
  if (!row) return null;
  return JSON.parse(row) as AggregationStatistics;
};

export const toAudioFileFeatures: ToAudioFileFeatures = (row) => {
  if (!row) return null;
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
  if (!row) return null;
  return {
    album: row.aiAlbum,
    duration: row.duration,
    date: row.originalDate,
    genres: row.trackGenres?.map((genre) => genre.genre.name) || [],
    subgenres:
      row.trackSubgenres?.map((subgenre) => subgenre.subgenre.name) || [],
  };
};

export const toAudioFileAIMetadata: ToAudioFileAIMetadata = (row) => {
  if (!row) return null;
  return {
    description: row.aiDescription,
    tags: JSON.parse(row.aiTags),
    vocalsDesc: row.vocalsDesc,
    atmosphereDesc: row.atmosphereDesc && JSON.parse(row.atmosphereDesc),
    contextBackground: row.contextBackground,
    contextImpact: row.contextImpact,
  };
};

export const toAudioFileAnalysis: ToAudioFileAnalysis = (row) => {
  if (!row) return null;
  return {
    status: row.analysisStatus as AudioFileAnalysisStatusEnum,
    startedAt: row.analysisStartedAt,
    completedAt: row.analysisCompletedAt,
    error: row.analysisError,
  };
};

export const toMusicTrackId = (row: PrismaMusicTrack): MusicTrackId => {
  return models.musicTrack.id(row.id);
};
export const toImagePath: ToImagePath = (row) => {
  if (!row) return null;
  return row.imageSearches?.[0]?.imagePath || '';
};
export const toDomain: ToDomain = (row) => {
  if (!row) return null;
  return {
    id: toMusicTrackId(row),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
    }),
    libraryId: models.musicLibrary.id(row.libraryId),
    title: row.originalTitle,
    artist: row.originalArtist,
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
    originalTitle: domainModel.title,
    originalArtist: domainModel.artist,
    duration: domainModel.technicalInfo?.duration,
    originalDate: domainModel.metadata?.date,
    isFavorite: domainModel.stats?.isFavorite,
    isLiked: domainModel.stats?.isLiked,
    isBanger: domainModel.stats?.isBanger,
    analysisStatus: domainModel.analysisInfo?.status,
    analysisStartedAt: domainModel.analysisInfo?.startedAt,
    analysisCompletedAt: domainModel.analysisInfo?.completedAt,
    analysisError: domainModel.analysisInfo?.error,
    hasMusicbrainz: false,
    hasDiscogs: false,
    libraryId: extractModelId(domainModel.libraryId).dbId,
    filePath: domainModel.fileInfo?.filePath,
    fileName: domainModel.fileInfo?.fileName,
    fileSize: domainModel.fileInfo?.fileSize,
    format: domainModel.technicalInfo?.format,
    bitrate: domainModel.technicalInfo?.bitrate,
    sampleRate: domainModel.technicalInfo?.sampleRate,
    fileCreatedAt: domainModel.fileInfo?.fileCreatedAt,
    originalAlbum: domainModel.metadata?.album,
    originalYear: domainModel.metadata?.date?.getFullYear(),
    originalAlbumartist: domainModel.artist,
    originalBpm: domainModel.features?.musicalFeatures?.tempo,
    originalTrack_number: 0,
    originalDisc_number: '0',
    originalComment: '',
    originalComposer: '',
    originalCopyright: '',
    aiTitle: domainModel.title,
    aiArtist: domainModel.artist,
    aiAlbum: domainModel.metadata?.album,
    aiConfidence: 0,
    aiSubgenreConfidence: 0,
    aiDescription: domainModel.aiMetadata?.description,
    aiTags: domainModel.aiMetadata?.tags?.join(','),
    vocalsDesc: domainModel.aiMetadata?.vocalsDesc,
    atmosphereDesc: domainModel.aiMetadata?.atmosphereDesc?.join(','),
    contextBackground: domainModel.aiMetadata?.contextBackground,
    contextImpact: domainModel.aiMetadata?.contextImpact,
    userTitle: domainModel.title,
    userArtist: domainModel.artist,
    userAlbum: domainModel.metadata?.album,
    userTags: domainModel.aiMetadata?.tags?.join(','),
    listeningCount: domainModel.stats?.listeningCount,
    lastPlayedAt: domainModel.stats?.lastPlayedAt,
    imagePath: domainModel?.imagePath,
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
