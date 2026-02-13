import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { FileInfo } from '../../ports/dtos/FileInfo';
import { IFileManager } from '../../ports/infrastructure/IFileManager';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IScanProgressPublisher } from '../../ports/infrastructure/IScanProgressPublisher';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';

export class ProcessStartLibraryScanUseCase {
  constructor(
    private readonly fileManager: IFileManager,
    private readonly musicLibraryRepository: IMusicLibraryRepository,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
    private readonly scanProgressPublisher: IScanProgressPublisher,
    private readonly scanSessionRepository: IScanSessionRepository,
  ) {
    this.logger = loggerFactory.createLogger('ProcessStartLibraryScanUseCase');
  }

  async execute(
    libraryId: MusicLibraryId,
    incremental: boolean,
    sessionId: SessionId,
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
      const session = await this.scanSessionRepository.getSession(sessionId);
      if (!session) {
        this.logger.error(`Session ${sessionId} not found`);
        return [];
      }
      await this.scanProgressPublisher.publishEvent(sessionId, {
        type: 'scan.complete',
        sessionId: libraryId,
        timestamp: new Date().toISOString(),
        libraryId,
        data: {
          totalBatches: session.totalBatches,
          totalTracks: session.totalTracks,
          successful: session.completedTracks,
          failed: session.failedTracks,
          duration: Date.now() - session.startedAt.getTime(),
        },
        overallProgress: 10000,
      });

      return [];
    }
    return audioFiles;
  }
}
