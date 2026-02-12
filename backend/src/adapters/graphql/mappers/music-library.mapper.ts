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
    lastScanAt: domain.scanInfo.lastScanAt ?? undefined,
    lastIncrementalScanAt: domain.scanInfo.lastIncrementalScanAt ?? undefined,
    scanStatus: domain.scanInfo.scanStatus ?? '',
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt ?? undefined,
    settings: {
      autoScan: domain.settings.autoScan,
      includeSubdirectories: domain.settings.includeSubdirectories,
      supportedFormats: domain.settings.supportedFormats.join(','),
      maxFileSize: domain.settings.maxFileSize,
      scanInterval: domain.settings.scanInterval,
    },
  };
}
