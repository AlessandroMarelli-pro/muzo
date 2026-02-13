import { MusicLibrary as PrismaMusicLibrary } from '@prisma/client';
import { extractModelId } from 'src/kernel/ids';
import { models, MusicLibrary } from 'src/kernel/types';
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
      updatedAt: row.updatedAt ?? undefined,
      updatedById: row.updatedById ?? undefined,
    }),
    name: row.name,
    rootPath: row.rootPath,
    tracksInfo: {
      totalTracks: row.totalTracks ?? 0,
      analyzedTracks: row.analyzedTracks ?? 0,
      pendingTracks: row.pendingTracks ?? 0,
      failedTracks: row.failedTracks ?? 0,
    },
    scanInfo: {
      lastScanAt: row.lastScanAt ?? null,
      lastIncrementalScanAt: row.lastIncrementalScanAt ?? null,
      scanStatus: row.scanStatus ?? null,
    },
    settings: {
      autoScan: row.autoScan ?? true,
      scanInterval: row.scanInterval ?? 24,
      includeSubdirectories: row.includeSubdirectories ?? true,
      supportedFormats: row.supportedFormats.split(',') ?? [
        'MP3',
        'FLAC',
        'WAV',
        'AAC',
        'OGG',
        'OPUS',
        'M4A',
      ],
      maxFileSize: row.maxFileSize ?? 100 * 1024 * 1024,
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
    scanStatus: domainModel.scanInfo.scanStatus ?? 'IDLE',
    autoScan: domainModel.settings.autoScan,
    scanInterval: domainModel.settings.scanInterval,
    includeSubdirectories: domainModel.settings.includeSubdirectories,
    supportedFormats: domainModel.settings.supportedFormats.join(','),
    maxFileSize: domainModel.settings.maxFileSize,
  };
};

type FlatLibraryUpdate = Partial<MusicLibrary> & {
  scanStatus?: MusicLibrary['scanInfo']['scanStatus'];
  lastScanAt?: Date | null;
  lastIncrementalScanAt?: Date | null;
  analyzedTracks?: number;
  failedTracks?: number;
};

/** Accepts nested (domain) or flat update shape for scan/track fields */
export const toPrismaUpdate = (
  domainModel: FlatLibraryUpdate,
): Partial<PrismaMusicLibrary> => {
  const updatedModel = models.musicLibrary.update(domainModel);
  const flat = domainModel as FlatLibraryUpdate;
  return {
    ...toDbModelUpdate(updatedModel),
    name: domainModel.name,
    scanStatus:
      domainModel.scanInfo?.scanStatus ?? flat.scanStatus ?? 'IDLE',
    lastScanAt:
      domainModel.scanInfo?.lastScanAt ?? flat.lastScanAt ?? undefined,
    lastIncrementalScanAt:
      domainModel.scanInfo?.lastIncrementalScanAt ??
      flat.lastIncrementalScanAt ??
      undefined,
    analyzedTracks:
      domainModel.tracksInfo?.analyzedTracks ?? flat.analyzedTracks ?? undefined,
    failedTracks:
      domainModel.tracksInfo?.failedTracks ?? flat.failedTracks ?? undefined,
  };
};
