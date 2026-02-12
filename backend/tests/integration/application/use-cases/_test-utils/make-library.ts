import type { MusicLibrary } from 'src/kernel/types';
import { models } from 'src/kernel/types/models';

const TEST_USER_ID = 'test-user-id';

export function makeLibrary(
  overrides: Partial<Omit<MusicLibrary, 'id'>> & { id: string },
): MusicLibrary {
  const id = models.musicLibrary.id(overrides.id);
  return {
    createdAt: new Date(),
    createdById: models.user.id(TEST_USER_ID),
    updatedAt: undefined,
    updatedById: undefined,
    name: 'Test Library',
    rootPath: '/music',
    tracksInfo: {
      totalTracks: 0,
      analyzedTracks: 0,
      pendingTracks: 0,
      failedTracks: 0,
    },
    scanInfo: {
      lastScanAt: null,
      lastIncrementalScanAt: null,
      scanStatus: 'IDLE',
    },
    settings: {
      autoScan: true,
      scanInterval: 24,
      includeSubdirectories: true,
      supportedFormats: ['MP3', 'FLAC', 'WAV'],
      maxFileSize: 100 * 1024 * 1024,
    },
    ...overrides,
    id,
  };
}
