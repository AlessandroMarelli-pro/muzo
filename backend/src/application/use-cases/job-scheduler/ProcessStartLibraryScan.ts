import { MusicLibraryId } from 'src/kernel/ids';
import { FileInfo } from '../../ports/dtos/FileInfo';
import { IFileManager } from '../../ports/infrastructure/IFileManager';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';

export class ProcessStartLibraryScanUseCase {
  constructor(
    private readonly fileManager: IFileManager,
    private readonly musicLibraryRepository: IMusicLibraryRepository,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {}

  async execute(
    libraryId: MusicLibraryId,
    incremental: boolean,
  ): Promise<FileInfo[]> {
    const library = await this.musicLibraryRepository.getOneById(libraryId);

    this.logger.info(`Scanning library ${libraryId}`, { library });

    const lastIncrementalScanAt =
      library?.scanInfo?.lastIncrementalScanAt ?? undefined;

    // Get all audio files in the library
    const audioFiles = await this.fileManager.scanDirectory(
      library.rootPath,
      library.settings.supportedFormats,
      {
        recursive: true,
        includeHidden: false,
        maxDepth: 10,
        newerThan: incremental ? lastIncrementalScanAt : undefined,
      },
      0,
    );

    if (audioFiles.length === 0) {
      await this.musicLibraryRepository.updateScanStatus(libraryId, 'IDLE');
      this.logger.warn(`No audio files found in library ${libraryId}`);
      return [];
    }
    return audioFiles;
  }
}
