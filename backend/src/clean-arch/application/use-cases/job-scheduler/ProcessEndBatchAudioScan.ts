import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import { ActionContext } from 'src/clean-arch/kernel/types';
import { AudioScanBatchJobData } from '../../ports/dtos/JobSchedulersData';
import { BatchCompleteEvent } from '../../ports/dtos/ScanProgress.types';
import { ILibraryScanSchedulerProducer } from '../../ports/infrastructure/ILibraryScanSchedulerProducer';
import { IScanProgressPublisher } from '../../ports/infrastructure/IScanProgressPublisher';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';

export class ProcessEndBatchAudioScanUseCase {
  constructor(
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly scanProgressPublisher: IScanProgressPublisher,
    private readonly libraryScanSchedulerProducer: ILibraryScanSchedulerProducer,
  ) {}

  async execute(
    data: AudioScanBatchJobData,
    libraryId: MusicLibraryId,
    incremental: boolean,
    contextUser: ActionContext['user'],
    totalTracks: number,
  ): Promise<void> {
    const { totalFiles, totalBatches, audioFiles, sessionId } = data;
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
      return;
    }
    const isComplete = session.completedBatches === session.totalBatches;
    const batchCompleteEvent: BatchCompleteEvent = {
      type: 'batch.complete',
      sessionId,
      timestamp: new Date().toISOString(),
      libraryId,
      batchIndex: 1,
      data: {
        successful: totalFiles,
        failed: 0,
        totalTracks: totalFiles,
      },
      overallProgress: isComplete ? 10000 : session.overallProgress,
    };

    console.debug(
      `Progress update for ${libraryId}: ${session.completedBatches}/${session.totalBatches} (${session.overallProgress.toFixed(1)}%)`,
    );
    await this.scanProgressPublisher.publishEvent(
      sessionId,
      batchCompleteEvent,
    );

    // Update progress tracking
    if (isComplete) {
      await this.libraryScanSchedulerProducer.scheduleEndLibraryScan(
        libraryId,
        sessionId,
        contextUser,
        totalTracks,
        incremental,
      );
    }
    // Update job progress
  }
}
