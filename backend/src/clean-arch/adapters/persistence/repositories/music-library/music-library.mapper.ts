import { MusicLibrary as PrismaMusicLibrary } from '@prisma/client';
import { extractModelId } from 'src/clean-arch/kernel/ids';
import { models, MusicLibrary } from 'src/clean-arch/kernel/types';
import { toDbModel, toDbModelUpdate } from '../db';
import { toDomainModel } from '../domain';
type ToDomain = (row: PrismaMusicLibrary) => MusicLibrary;
type ToDomainArray = (rows: PrismaMusicLibrary[]) => MusicLibrary[];

export const toDomainArray: ToDomainArray = (rows) => {
  return rows.map(toDomain);
};

export const toDomain: ToDomain = (row) => {
  return {
    id: models.musicLibrary.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
    }),
    name: row.name,
    rootPath: row.rootPath,
    tracksInfo: {
      totalTracks: row.totalTracks,
      analyzedTracks: row.analyzedTracks,
      pendingTracks: row.pendingTracks,
      failedTracks: row.failedTracks,
    },
    scanInfo: {
      lastScanAt: row.lastScanAt,
      lastIncrementalScanAt: row.lastIncrementalScanAt,
      scanStatus: row.scanStatus,
    },
    settings: {
      autoScan: row.autoScan,
      scanInterval: row.scanInterval,
      includeSubdirectories: row.includeSubdirectories,
      supportedFormats: row.supportedFormats.split(','),
      maxFileSize: row.maxFileSize,
    },
  };
};

type ToPrisma = (domainModel: MusicLibrary) => PrismaMusicLibrary;

export const toPrisma: ToPrisma = (domainModel) => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    name: domainModel.name,
    rootPath: domainModel.rootPath,
    totalTracks: domainModel.tracksInfo.totalTracks,
    analyzedTracks: domainModel.tracksInfo.analyzedTracks,
    pendingTracks: domainModel.tracksInfo.pendingTracks,
    failedTracks: domainModel.tracksInfo.failedTracks,
    lastScanAt: domainModel.scanInfo.lastScanAt,
    lastIncrementalScanAt: domainModel.scanInfo.lastIncrementalScanAt,
    scanStatus: domainModel.scanInfo.scanStatus,
    autoScan: domainModel.settings.autoScan,
    scanInterval: domainModel.settings.scanInterval,
    includeSubdirectories: domainModel.settings.includeSubdirectories,
    supportedFormats: domainModel.settings.supportedFormats.join(','),
    maxFileSize: domainModel.settings.maxFileSize,
  };
};

export const toPrismaUpdate = (
  domainModel: Partial<MusicLibrary>,
): Partial<PrismaMusicLibrary> => {
  const updatedModel = models.musicLibrary.update(domainModel);
  return {
    ...toDbModelUpdate(updatedModel),
    name: domainModel.name,
    scanStatus: domainModel.scanInfo?.scanStatus,
  };
};
