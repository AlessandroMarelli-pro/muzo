import { MusicLibrary } from 'src/kernel/types/model-types';
import { Library } from '../schema/library.schema';

export function toMusicLibrary(domain: MusicLibrary): Library {
  return {
    id: domain.id,
    name: domain.name,
    rootPath: domain.rootPath,
    totalTracks: domain.tracksInfo.totalTracks,
    analyzedTracks: domain.tracksInfo.analyzedTracks,
    pendingTracks: domain.tracksInfo.pendingTracks,
    failedTracks: domain.tracksInfo.failedTracks,
    lastScanAt: domain.scanInfo.lastScanAt,
    lastIncrementalScanAt: domain.scanInfo.lastIncrementalScanAt,
    scanStatus: domain.scanInfo.scanStatus,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    settings: {
      autoScan: domain.settings.autoScan,
      includeSubdirectories: domain.settings.includeSubdirectories,
      supportedFormats: domain.settings.supportedFormats.join(','),
      maxFileSize: domain.settings.maxFileSize,
      scanInterval: domain.settings.scanInterval,
    },
  };
}
