import { Inject, Injectable } from '@nestjs/common';
import { models, MusicLibrary } from 'src/clean-arch/kernel/types';
import {
  IMusicLibraryRepository,
  MUSIC_LIBRARY_REPOSITORY,
  MusicLibraryCreateData,
} from '../../ports/repositories/IMusicLibraryRepository';

@Injectable()
export class CreateLibraryUseCase {
  constructor(
    @Inject(MUSIC_LIBRARY_REPOSITORY)
    private readonly musicLibraryRepository: IMusicLibraryRepository,
  ) {}

  async execute(libraryData: MusicLibraryCreateData): Promise<MusicLibrary> {
    const musicLibrary = models.musicLibrary.instantiateNew({
      name: libraryData.name,
      rootPath: libraryData.rootPath,
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
        autoScan: libraryData.autoScan ?? true,
        scanInterval: libraryData.scanInterval ?? 24,
        includeSubdirectories: libraryData.includeSubdirectories ?? true,
        supportedFormats: libraryData.supportedFormats ?? [
          'MP3',
          'FLAC',
          'WAV',
          'AAC',
          'OGG',
          'OPUS',
          'M4A',
        ],
        maxFileSize: libraryData.maxFileSize ?? 100 * 1024 * 1024,
      },
    });
    return this.musicLibraryRepository.save(musicLibrary);
  }
}
