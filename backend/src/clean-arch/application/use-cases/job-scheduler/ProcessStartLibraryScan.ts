import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import {
  FileInfo,
  IFileManager,
} from '../../ports/infrastructure/IFileManager';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';

export class ProcessStartLibraryScanUseCase {
  constructor(
    private readonly fileManager: IFileManager,
    private readonly musicLibraryRepository: IMusicLibraryRepository,
  ) {}

  async execute(
    libraryId: MusicLibraryId,
    sessionId: string,
    incremental: boolean,
  ): Promise<FileInfo[]> {
    const library = await this.musicLibraryRepository.getOneById(libraryId);

    // Get all audio files in the library
    const audioFiles = await this.fileManager.scanDirectory(
      library.rootPath,
      library.settings.supportedFormats,
      {
        recursive: true,
        includeHidden: false,
        maxDepth: 10,
        newerThan: incremental
          ? library.scanInfo.lastIncrementalScanAt
          : undefined,
      },
      0,
    );

    if (audioFiles.length === 0) {
      return;
    }
    return audioFiles;
  }
}
