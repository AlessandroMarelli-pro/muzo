import {
  AudioFingerprint as PrismaAudioFingerprint,
  Genre as PrismaGenre,
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
  AudioFileAnalysis,
  AudioFileAnalysisStatusEnum,
  AudioFileFeatures,
  AudioFileInfo,
  AudioFileMetadata,
  AudioTechnical,
  MusicTrack,
  MusicTrackStats,
} from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDbModel } from '../db';
import { toDomainModel } from '../domain';

export type ImageSearchLite = {
  id: string;
  imagePath: string | null;
  imageUrl: string | null;
  imageMimeType: string | null;
  source: string | null;
};

export type PrismaMusicTrackWithRelations = PrismaMusicTrack & {
  audioFingerprint?: Maybe<PrismaAudioFingerprint>;
  trackGenres?: Maybe<(PrismaTrackGenre & { genre: PrismaGenre })[]>;
  trackSubgenres?: Maybe<(PrismaTrackSubgenre & { subgenre: PrismaSubgenre })[]>;
  imageSearches?: Maybe<ImageSearchLite[]>;
};

export type ToDomain = (row: PrismaMusicTrackWithRelations) => MusicTrack;

export type ToMusicTrackStats = (row: PrismaMusicTrack) => MaybeUndefined<MusicTrackStats>;

export type ToAudioFileInfo = (row: PrismaMusicTrack) => AudioFileInfo;
export type ToAudioTechnical = (row: PrismaMusicTrack) => MaybeUndefined<AudioTechnical>;
export type ToAudioFileFeatures = (
  row?: Maybe<PrismaAudioFingerprint>,
) => MaybeUndefined<AudioFileFeatures>;
export type ToAudioFileMetadata = (
  row: PrismaMusicTrackWithRelations,
) => MaybeUndefined<AudioFileMetadata>;
export type ToImagePath = (row: PrismaMusicTrackWithRelations) => MaybeUndefined<string>;
export type ToAudioFileAnalysis = (row: PrismaMusicTrack) => MaybeUndefined<AudioFileAnalysis>;

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

const parseEmbeddingStored = (raw: string): number[] => {
  try {
    const parsed: unknown = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.map((n) => Number(n)) : [];
  } catch {
    return [];
  }
};

const safeJsonParse = <T>(raw: string | null | undefined, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const toAudioFileFeatures: ToAudioFileFeatures = (row) => {
  if (!row) return undefined;
  const embedding = parseEmbeddingStored(row.embedding);
  const instruments = safeJsonParse<{ instrument: string; confidence: number }[]>(
    row.instruments,
    [],
  );
  const tags = safeJsonParse<{ tag: string; confidence: number }[]>(row.tags, []);
  const warnings = safeJsonParse<
    { model: string; reason: 'disabled' | 'failed' | 'empty'; detail: string | null }[]
  >(row.warnings, []);
  return {
    ...(embedding.length > 0 ? { embedding, embeddingDim: row.embeddingDim ?? undefined } : {}),
    ...(instruments.length > 0 ? { instruments } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
    musicalFeatures: {
      tempo: row.tempo ?? undefined,
      tempoConfidence: row.tempoConfidence ?? undefined,
      key: row.key ?? undefined,
      camelotKey: row.camelotKey ?? undefined,
      mode: row.mode ?? undefined,
      valence: row.valence ?? undefined,
      valenceMood: row.valenceMood ?? undefined,
      arousal: row.arousal ?? undefined,
      arousalMood: row.arousalMood ?? undefined,
      danceability: row.danceability ?? undefined,
      danceabilityFeeling: row.danceabilityFeeling ?? undefined,
      instrumentalness: row.instrumentalness ?? undefined,
      voice: row.voice ?? undefined,
      moodHappy: row.moodHappy ?? undefined,
      moodSad: row.moodSad ?? undefined,
      moodRelaxed: row.moodRelaxed ?? undefined,
      moodAggressive: row.moodAggressive ?? undefined,
      moodParty: row.moodParty ?? undefined,
    },
  };
};

export const toAudioFileMetadata: ToAudioFileMetadata = (row) => {
  if (!row) return undefined;
  return {
    album: row.originalAlbum ?? undefined,
    duration: row.duration ?? undefined,
    date: row.originalDate ?? undefined,
    genres: row.trackGenres?.map((genre) => genre.genre.name) || [],
    subgenres: row.trackSubgenres?.map((subgenre) => subgenre.subgenre.name) || [],
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
  // Cover-art bytes are stored in the DB (image_searches.image_data), not on a
  // filesystem the backend can read. Surface the track id so the client can hit
  // GET /api/images/serve?imagePath=<trackId>, which serves the bytes from the DB.
  // imageMimeType is persisted iff imageData (the bytes) is; the lite select
  // deliberately omits the bytes themselves.
  const hasStoredImage = row.imageSearches?.some((s) => s.imageMimeType != null) ?? false;
  return hasStoredImage ? row.id : undefined;
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
    hqAudioPath: row.hqAudioPath ?? undefined,
    stats: toMusicTrackStats(row),
    fileInfo: toAudioFileInfo(row),
    technicalInfo: toAudioTechnical(row),
    features: toAudioFileFeatures(row.audioFingerprint),
    metadata: toAudioFileMetadata(row),
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
    libraryId: extractModelId(domainModel.libraryId).dbId,
    filePath: domainModel.fileInfo?.filePath,
    hqAudioPath: domainModel.hqAudioPath ?? null,
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
    aiConfidence: 0,
    listeningCount: domainModel.stats?.listeningCount ?? 0,
    lastPlayedAt: domainModel.stats?.lastPlayedAt ?? null,
  };
};

export type ToPrismaUpdate = (data: MusicTrackUpdateData) => Partial<PrismaMusicTrack>;

export const toPrismaUpdate: ToPrismaUpdate = (data) => {
  const stats = data.stats ?? undefined;
  return {
    isLiked: stats?.isLiked ?? undefined,
    isBanger: stats?.isBanger ?? undefined,
    isFavorite: stats?.isFavorite ?? undefined,
    analysisStatus: data.analysisStatus ?? undefined,
    analysisStartedAt: data.analysisStartedAt ?? undefined,
    analysisCompletedAt: data.analysisCompletedAt ?? undefined,
    analysisError: data.analysisError ?? undefined,
    duration: data.duration ?? undefined,
    format: data.format ?? undefined,
    fileCreatedAt: data.fileCreatedAt ?? undefined,
    filePath: data.filePath ?? undefined,
    hqAudioPath: data.hqAudioPath ?? undefined,
    fileName: data.fileName ?? undefined,
    fileSize: data.fileSize ?? undefined,
  };
};
