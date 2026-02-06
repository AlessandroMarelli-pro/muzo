import { HiddenMusicTrack as PrismaHiddenMusicTrack } from '@prisma/client';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { models } from 'src/clean-arch/kernel/types';
import { HiddenMusicTrack } from 'src/clean-arch/kernel/types/model-types';
import { toDbModel } from '../db';
import { toDomainModel } from '../domain';

export type ToDomain = (
  prismaModel: PrismaHiddenMusicTrack,
) => HiddenMusicTrack;

export const toDomain: ToDomain = (row) => {
  return {
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
    }),
    id: models.hiddenMusicTrack.id(row.id),
    libraryId: models.musicLibrary.id(row.libraryId),
    title: row.originalTitle,
    artist: row.originalArtist,
    imagePath: '',
    fileInfo: {
      filePath: row.filePath,
      fileName: row.fileName,
      fileSize: row.fileSize,
      fileCreatedAt: row.createdAt,
    },
    technicalInfo: {
      duration: row.duration,
      format: row.format,
      bitrate: row.bitrate,
      sampleRate: row.sampleRate,
    },
    aiMetadata: {
      description: row.aiDescription,
      tags: row.aiTags && JSON.parse(row.aiTags),
      vocalsDesc: row.vocalsDesc,
      atmosphereDesc: row.atmosphereDesc && JSON.parse(row.atmosphereDesc),
      contextBackground: row.contextBackground,
      contextImpact: row.contextImpact,
    },
  };
};

export type ToPrisma = (
  domainModel: HiddenMusicTrack,
) => PrismaHiddenMusicTrack;

export const toPrisma: ToPrisma = (domainModel) => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    filePath: domainModel.fileInfo.filePath,
    fileName: domainModel.fileInfo.fileName,
    fileSize: domainModel.fileInfo.fileSize,
    duration: domainModel.technicalInfo.duration,
    format: domainModel.technicalInfo.format,
    bitrate: domainModel.technicalInfo.bitrate,
    sampleRate: domainModel.technicalInfo.sampleRate,
    originalTitle: domainModel.title,
    originalArtist: domainModel.artist,
    originalAlbum: '',
    originalYear: 0,
    originalAlbumartist: domainModel.artist,
    originalDate: domainModel.fileInfo.fileCreatedAt,
    originalBpm: 0,
    originalTrack_number: 0,
    originalDisc_number: '0',
    originalComment: '',
    originalComposer: '',
    originalCopyright: '',
    aiTitle: domainModel.title,
    aiArtist: domainModel.artist,
    aiAlbum: '',
    aiConfidence: 0,
    aiSubgenreConfidence: 0,
    aiDescription: domainModel.aiMetadata.description,
    aiTags: domainModel.aiMetadata.tags.join(','),
    vocalsDesc: domainModel.aiMetadata.vocalsDesc,
    atmosphereDesc: domainModel.aiMetadata.atmosphereDesc.join(','),
    contextBackground: domainModel.aiMetadata.contextBackground,
    contextImpact: domainModel.aiMetadata.contextImpact,
    userTitle: domainModel.title,
    userArtist: domainModel.artist,
    userAlbum: '',
    userTags: domainModel.aiMetadata.tags.join(','),
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
