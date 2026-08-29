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
    aiConfidence: 0,
    listeningCount: 0,
    lastPlayedAt: null,
    isFavorite: false,
    isLiked: false,
    isBanger: false,
    analysisStatus: 'PENDING',
    analysisStartedAt: null,
    analysisCompletedAt: null,
    analysisError: null,
    libraryId: extractModelId(domainModel.libraryId).dbId,
  };
};
