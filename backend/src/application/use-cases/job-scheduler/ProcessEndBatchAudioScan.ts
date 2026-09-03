import { MusicLibraryId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';
import { AudioScanBatchJobData } from '../../ports/dtos/JobSchedulersData';
import { BatchCompleteEvent } from '../../ports/dtos/ScanProgress.types';
import { ILibraryScanSchedulerProducer } from '../../ports/infrastructure/ILibraryScanSchedulerProducer';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IScanProgressPublisher } from '../../ports/infrastructure/IScanProgressPublisher';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';

export class ProcessEndBatchAudioScanUseCase {
  constructor(
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly scanProgressPublisher: IScanProgressPublisher,
    private readonly libraryScanSchedulerProducer: ILibraryScanSchedulerProducer,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('ProcessEndBatchAudioScanUseCase');
  }

  async execute(
    data: AudioScanBatchJobData,
    libraryId: MusicLibraryId,
    incremental: boolean,
    contextUser: ActionContext['user'],
    batchFailed = false,
  ): Promise<void> {
    const { totalFiles, audioFiles, sessionId, batchIndex } = data;
    // Update session progress. Even when the batch failed (e.g. AI analysis or a downstream
    // sync threw), completedBatches must still advance -- otherwise the scan can never reach
    // totalBatches and stalls forever. overallProgress is derived from completedBatches/
    // totalBatches inside updateSessionProgress, not passed in here.
    //
    // completedTracks/failedTracks are NOT incremented here: ProcessBatchAudioScanUseCase
    // already records the real per-file successful/failed split as soon as the batch's
    // results are known, right after analyzeAudioBatch returns. Incrementing them again here
    // would double-count every track. The one exception is a batch that failed outright
    // (batchFailed) before any per-file split could be recorded -- account those as failed here.
    const session = await this.scanSessionRepository.updateSessionProgress(sessionId, {
      completedBatches: 1,
      ...(batchFailed ? { failedTracks: audioFiles.length } : {}),
    });
    if (!session) {
      this.logger.error(
        `Failed to update session progress for session ${sessionId} (session not found or not in SCANNING status)`,
      );
      return;
    }
    this.logger.info(`Updated session progress for session ${sessionId}`, {
      ...data,
      completedBatches: session.completedBatches,
      totalBatches: session.totalBatches,
    });
    const isComplete = session.completedBatches === session.totalBatches;
    // overallProgress leaves the backend as a 0-100 percentage; session.overallProgress is
    // basis points (0-10000) in the DB.
    const overallProgressPercent = isComplete ? 100 : session.overallProgress / 100;
    const batchCompleteEvent: BatchCompleteEvent = {
      type: 'batch.complete',
      sessionId,
      timestamp: new Date().toISOString(),
      libraryId,
      batchIndex,
      data: {
        successful: batchFailed ? 0 : totalFiles,
        failed: batchFailed ? totalFiles : 0,
        totalTracks: totalFiles,
      },
      overallProgress: overallProgressPercent,
    };

    this.logger.debug(
      `Progress update for ${libraryId}: ${session.completedBatches}/${session.totalBatches} (${overallProgressPercent.toFixed(1)}%)`,
    );
    await this.scanProgressPublisher.publishEvent(sessionId, batchCompleteEvent);

    // Update progress tracking
    if (isComplete) {
      this.logger.info(`Scheduling end library scan for library ${libraryId}`);
      await this.libraryScanSchedulerProducer.scheduleEndLibraryScan(
        libraryId,
        sessionId,
        contextUser,
        incremental,
      );
    }
    // Update job progress
  }
}
