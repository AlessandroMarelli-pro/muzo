import { HiddenMusicTrack as PrismaHiddenMusicTrack } from '@prisma/client';
import { extractModelId } from 'src/kernel/ids/factory';
import { models } from 'src/kernel/types';
import { HiddenMusicTrack } from 'src/kernel/types/model-types';
import { toDbModel } from '../db';
import { toDomainModel } from '../domain';

export type ToDomain = (prismaModel: PrismaHiddenMusicTrack) => HiddenMusicTrack;

export const toDomain: ToDomain = (row) => {
  return {
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt ?? undefined,
      updatedById: row.updatedById ?? undefined,
    }),
    id: models.hiddenMusicTrack.id(row.id),
    libraryId: models.musicLibrary.id(row.libraryId),
    title: row.originalTitle ?? '',
    artist: row.originalArtist ?? '',
    imagePath: '',
    fileInfo: {
      filePath: row.filePath,
      fileName: row.fileName,
      fileSize: row.fileSize,
      fileCreatedAt: row.createdAt,
    },
    technicalInfo: {
      duration: row.duration ?? 0,
      format: row.format,
      bitrate: row.bitrate ?? undefined,
      sampleRate: row.sampleRate ?? undefined,
    },
    aiMetadata: {
      description: row.aiDescription ?? '',
      tags: row.aiTags && JSON.parse(row.aiTags),
      vocalsDesc: row.vocalsDesc ?? '',
      contextBackground: row.contextBackground ?? '',
      contextImpact: row.contextImpact ?? '',
    },
  };
};

export type ToPrisma = (domainModel: HiddenMusicTrack) => PrismaHiddenMusicTrack;

export const toPrisma: ToPrisma = (domainModel) => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    filePath: domainModel.fileInfo.filePath ?? null,
    fileName: domainModel.fileInfo.fileName ?? null,
    fileSize: domainModel.fileInfo.fileSize,
    duration: domainModel.technicalInfo?.duration ?? 0,
    format: domainModel.technicalInfo?.format ?? '',
    bitrate: domainModel.technicalInfo?.bitrate ?? null,
    sampleRate: domainModel.technicalInfo?.sampleRate ?? null,
    originalTitle: domainModel.title,
    originalArtist: domainModel.artist ?? null,
    originalAlbum: '',
    originalYear: 0,
    originalAlbumartist: domainModel.artist ?? null,
    originalDate: domainModel.fileInfo.fileCreatedAt ?? null,
    originalBpm: 0,
    originalTrack_number: 0,
    originalDisc_number: '0',
    originalComment: '',
    originalComposer: '',
    originalCopyright: '',
    aiTitle: domainModel.title ?? null,
    aiArtist: domainModel.artist ?? null,
    aiAlbum: '',
    aiConfidence: 0,
    aiSubgenreConfidence: 0,
    aiDescription: domainModel.aiMetadata?.description ?? null,
    aiTags:
      domainModel.aiMetadata?.tags != null ? JSON.stringify(domainModel.aiMetadata.tags) : null,
    vocalsDesc: domainModel.aiMetadata?.vocalsDesc ?? null,
    contextBackground: domainModel.aiMetadata?.contextBackground ?? null,
    contextImpact: domainModel.aiMetadata?.contextImpact ?? null,
    userTitle: domainModel.title ?? null,
    userArtist: domainModel.artist ?? null,
    userAlbum: null,
    userTags: domainModel.aiMetadata?.tags?.join(',') ?? null,
    listeningCount: 0,
    lastPlayedAt: null,
    isFavorite: false,
    isLiked: false,
    isBanger: false,
    analysisStatus: 'PENDING',
    analysisStartedAt: null,
    analysisCompletedAt: null,
    analysisError: null,
    hasMusicbrainz: false,
    hasDiscogs: false,
    libraryId: extractModelId(domainModel.libraryId).dbId,
  };
};
