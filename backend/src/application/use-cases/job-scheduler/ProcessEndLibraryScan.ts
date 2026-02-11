import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { AudioFileAnalysisStatusEnum, ScanStatusEnum } from 'src/kernel/types';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IScanProgressPublisher } from '../../ports/infrastructure/IScanProgressPublisher';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';

export class ProcessEndLibraryScanUseCase {
  constructor(
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly scanProgressPublisher: IScanProgressPublisher,
    private readonly musicLibraryRepository: IMusicLibraryRepository,
    private readonly musicTrackRepository: IMusicTrackRepository,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('ProcessEndLibraryScanUseCase');
  }

  async execute(
    libraryId: MusicLibraryId,
    sessionId: SessionId,
    incremental: boolean,
    totalTracks: number,
  ): Promise<void> {
    this.logger.info(
      `Ending library scan for library ${libraryId} with session ${sessionId}`,
      {
        libraryId,
        sessionId,
        incremental,
        totalTracks,
      },
    );
    // Get current library statistics
    const library = await this.musicLibraryRepository.getOneById(libraryId);
    const startDateTS = (
      await this.scanSessionRepository.getSession(sessionId)
    ).createdAt.getTime();
    if (!library) {
      this.logger.error(`Library not found: ${libraryId}`);
      throw new Error(`Library not found: ${libraryId}`);
    }
    await this.scanSessionRepository.completeSession(sessionId, true);
    await this.scanProgressPublisher.publishEvent(sessionId, {
      type: 'scan.complete',
      sessionId: libraryId,
      timestamp: new Date().toISOString(),
      libraryId,
      data: {
        totalBatches: 1,
        totalTracks,
        successful: totalTracks,
        failed: 0,
        duration: Date.now() - startDateTS,
      },
      overallProgress: 10000,
    });
    const analysisStatusCounts =
      await this.musicTrackRepository.getAnalysisStatusForManyByLibraryId(
        libraryId,
      );
    console.log(analysisStatusCounts);
    // Calculate current statistics
    const analyzedTracks =
      analysisStatusCounts.find(
        ({ analysisStatus }) =>
          analysisStatus === AudioFileAnalysisStatusEnum.COMPLETED,
      )?.count ?? 0;

    const pendingTracks =
      analysisStatusCounts.find(
        ({ analysisStatus }) =>
          analysisStatus === AudioFileAnalysisStatusEnum.PENDING,
      )?.count ?? 0;

    const failedTracks =
      analysisStatusCounts.find(
        ({ analysisStatus }) =>
          analysisStatus === AudioFileAnalysisStatusEnum.FAILED,
      )?.count ?? 0;

    // Update library with final statistics
    const updateData: any = {
      totalTracks,
      analyzedTracks,
      pendingTracks,
      failedTracks,
      scanStatus: ScanStatusEnum.IDLE,
    };

    // Update appropriate scan timestamp
    if (!incremental) {
      updateData.lastScanAt = new Date();
    } else {
      updateData.lastIncrementalScanAt = new Date();
    }

    this.logger.info(
      `Updating library ${libraryId} with data: ${JSON.stringify(updateData)}`,
    );
    await this.musicLibraryRepository.updateOneById(libraryId, {
      ...updateData,
    });
  }
}
