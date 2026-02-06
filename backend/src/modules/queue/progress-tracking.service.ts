import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QueueService } from './queue.service';
import { ScanProgressPubSubService } from './scan-progress-pubsub.service';
import { ScanSessionService } from './scan-session.service';

@Injectable()
export class ProgressTrackingService {
  private readonly logger = new Logger(ProgressTrackingService.name);

  constructor(
    @InjectQueue('audio-scan')
    private readonly audioScanQueue: Queue,
    private readonly queueService: QueueService,
    private readonly pubSubService: ScanProgressPubSubService,
    private readonly scanSessionService: ScanSessionService,
  ) {}

  /**
   * Update progress for a library scan
   * TODO : alternative -> add new queue for processing end job
   * Only one service will consume this queue and it will be responsible for updating the library progress
   */
  async updateLibraryProgress(
    libraryId: string,
    libraryName: string,
    totalFiles: number,
    startDateTS: number,
    isComplete: boolean,
  ): Promise<void> {
    try {
      if (isComplete) {
        await this.scanSessionService.completeSession(libraryId, true);
        await this.pubSubService.publishEvent(libraryId, {
          type: 'scan.complete',
          sessionId: libraryId,
          timestamp: new Date().toISOString(),
          libraryId,
          data: {
            totalBatches: 1,
            totalTracks: totalFiles,
            successful: totalFiles,
            failed: 0,
            duration: Date.now() - startDateTS,
          },
          overallProgress: 10000,
        });

        this.logger.log(
          `Completed scan for library ${libraryId}, cleaned up tracking`,
        );
        await this.queueService.scheduleEndScanLibrary(
          libraryId,
          libraryName,
          totalFiles,
          'incremental',
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to update progress for library ${libraryId}:`,
        error.message,
      );
    }
  }
}
