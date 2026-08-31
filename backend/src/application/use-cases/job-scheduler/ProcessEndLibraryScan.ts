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
  ): Promise<void> {
    this.logger.info(`Ending library scan for library ${libraryId} with session ${sessionId}`, {
      libraryId,
      sessionId,
      incremental,
    });

    const session = await this.scanSessionRepository.completeSession(sessionId, true);
    await this.scanProgressPublisher.publishEvent(sessionId, {
      type: 'scan.complete',
      sessionId,
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

    const analysisStatusCounts =
      await this.musicTrackRepository.getAnalysisStatusForManyByLibraryId(libraryId);

    // Calculate current statistics
    const analyzedTracks =
      analysisStatusCounts.find(
        ({ analysisStatus }) => analysisStatus === AudioFileAnalysisStatusEnum.COMPLETED,
      )?.count ?? 0;

    // "failedTracks" is really "not-yet-successfully-analyzed": FAILED plus any PENDING /
    // PROCESSING left over. That's what the "scan incomplete tracks" action targets, so the
    // counter must match it or the button would hide tracks it can still fix.
    const totalTracks = analysisStatusCounts.reduce((sum, { count }) => sum + count, 0);
    const failedTracks = totalTracks - analyzedTracks;

    // Update library with final statistics
    const updateData: any = {
      analyzedTracks,
      failedTracks,
      scanStatus: ScanStatusEnum.IDLE,
      totalTracks,
    };

    // Update appropriate scan timestamp
    if (!incremental) {
      updateData.lastScanAt = new Date();
    } else {
      updateData.lastIncrementalScanAt = new Date();
    }

    this.logger.info(`Updating library ${libraryId} with data: ${JSON.stringify(updateData)}`, {
      libraryId,
      updateData,
      analysisStatusCounts,
    });
    await this.musicLibraryRepository.updateOneById(libraryId, {
      ...updateData,
    });
  }
}
