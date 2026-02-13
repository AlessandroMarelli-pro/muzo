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
  ): Promise<void> {
    const { totalFiles, totalBatches, audioFiles, sessionId, batchIndex } =
      data;
    const progressPercentage = Math.round((1 / totalBatches!) * 10000);
    // Update session progress
    const session = await this.scanSessionRepository.updateSessionProgress(
      sessionId,
      {
        completedBatches: 1,
        progressPercentage,
        completedTracks: audioFiles.length,
      },
    );
    if (!session) {
      this.logger.error(
        `Failed to update session progress for session ${sessionId} (session not found or not in SCANNING status)`,
      );
      return;
    }
    this.logger.info(`Updated session progress for session ${sessionId}`, {
      ...data,
      progressPercentage,
      completedBatches: session.completedBatches,
      totalBatches: session.totalBatches,
    });
    const isComplete = session.completedBatches === session.totalBatches;
    const batchCompleteEvent: BatchCompleteEvent = {
      type: 'batch.complete',
      sessionId,
      timestamp: new Date().toISOString(),
      libraryId,
      batchIndex,
      data: {
        successful: totalFiles,
        failed: 0,
        totalTracks: totalFiles,
      },
      overallProgress: isComplete ? 10000 : session.overallProgress,
    };

    this.logger.debug(
      `Progress update for ${libraryId}: ${session.completedBatches}/${session.totalBatches} (${(session.overallProgress / 100).toFixed(1)}%)`,
    );
    await this.scanProgressPublisher.publishEvent(
      sessionId,
      batchCompleteEvent,
    );

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
