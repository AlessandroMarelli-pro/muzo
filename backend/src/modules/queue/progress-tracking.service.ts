import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { JobState, Queue } from 'bullmq';
import { QueueService } from './queue.service';
import { ScanProgressPubSubService } from './scan-progress-pubsub.service';
import { BatchCompleteEvent } from './scan-progress.types';
import { ScanSessionService } from './scan-session.service';


@Injectable()
export class ProgressTrackingService {
  private readonly logger = new Logger(ProgressTrackingService.name);

  // Track initial file counts for each library scan
  private readonly libraryScanTotals = new Map<string, number>();

  constructor(
    @InjectQueue('audio-scan')
    private readonly audioScanQueue: Queue,
    private readonly queueService: QueueService,
    private readonly pubSubService: ScanProgressPubSubService,
    private readonly scanSessionService: ScanSessionService,


  ) { }


  /**
   * Set the total files for a library scan
   */
  setLibraryScanTotal(libraryId: string, totalFiles: number): void {
    this.libraryScanTotals.set(libraryId, totalFiles);
    this.logger.log(
      `Set scan total for library ${libraryId}: ${totalFiles} files`,
    );
  }

  /**
   * Update progress for a library scan
   */
  async updateLibraryProgress(
    libraryId: string,
    libraryName: string,
  ): Promise<void> {
    try {
      const totalFiles = this.libraryScanTotals.get(libraryId) || 0;

      if (totalFiles === 0) {
        this.logger.warn(`No total files set for library ${libraryId}`);
        return;
      }

      // Get current queue statistics for this library
      const waitingJobs = await this.getJobsWithStatusForLibrary(libraryId, 'waiting');
      const activeJobs = await this.getJobsWithStatusForLibrary(libraryId, 'active');
      const completedJobs = await this.getJobsWithStatusForLibrary(libraryId, 'completed');


      const remainingFiles = waitingJobs + activeJobs;
      const processedFiles = totalFiles - remainingFiles + 1;
      const progressPercentage =
        totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0;

      console.log('waitingJobs', waitingJobs);
      console.log('activeJobs', activeJobs);
      console.log('completedJobs', completedJobs);
      console.log('progressPercentage', progressPercentage);
      console.log('totalFiles', totalFiles);
      console.log('processedFiles', processedFiles);
      console.log('remainingFiles', remainingFiles);
      // Determine status based on remaining files
      let status = 'SCANNING';
      if (progressPercentage === 100) {
        status = 'COMPLETED';
      }

      const overallProgress = Math.round(((processedFiles / totalFiles) * 10000)) / 100;
      const batchCompleteEvent: BatchCompleteEvent = {
        type: 'batch.complete',
        sessionId: libraryId,
        timestamp: new Date().toISOString(),
        libraryId,
        batchIndex: 1,
        data: {
          successful: processedFiles,
          failed: 0,
          totalTracks: totalFiles,
        },
        overallProgress
      };
      await this.pubSubService.publishEvent(libraryId, batchCompleteEvent);
      // Update session progress
      await this.scanSessionService.updateSessionProgress(libraryId, {
        completedBatches: completedJobs,
      });
      console.log('status', status,);
      this.logger.debug(
        `Progress update for ${libraryName}: ${processedFiles}/${totalFiles} (${progressPercentage.toFixed(1)}%)`,
      );


      if (status === 'COMPLETED') {
        await this.scanSessionService.completeSession(libraryId, true);
        await this.pubSubService.publishEvent(libraryId, {
          type: 'scan.complete',
          sessionId: libraryId,
          timestamp: new Date().toISOString(),
          libraryId,
          data: {
            totalBatches: 1,
            totalTracks: totalFiles,
            successful: processedFiles,
            failed: 0,
            duration: Date.now(),
          },
          overallProgress: 100,
        });

        this.libraryScanTotals.delete(libraryId);
        this.logger.log(
          `Completed scan for library ${libraryId}, cleaned up tracking`,
        );
        await this.queueService.scheduleEndScanLibrary(libraryId, libraryName, totalFiles, 'incremental');
      }
    } catch (error) {
      this.logger.error(
        `Failed to update progress for library ${libraryId}:`,
        error.message,
      );
    }
  }

  /**
   * Get waiting jobs count for a specific library
   */
  private async getJobsWithStatusForLibrary(libraryId: string, status: JobState): Promise<number> {
    try {
      const waitingJobs = await this.audioScanQueue.getJobs([status], 0, -1);
      return waitingJobs.filter(
        (job) =>
          job.data &&
          typeof job.data === 'object' &&
          'libraryId' in job.data &&
          job.data.libraryId === libraryId,
      ).length;
    } catch (error) {
      this.logger.error(
        `Failed to get waiting jobs for library ${libraryId}:`,
        error.message,
      );
      return 0;
    }
  }


  /**
   * Calculate estimated completion time
   */
  private calculateEstimatedCompletion(
    remainingFiles: number,
    activeJobs: number,
  ): Date | undefined {
    if (remainingFiles === 0 || activeJobs === 0) {
      return undefined;
    }

    // Estimate 30 seconds per file (this could be made configurable)
    const avgTimePerFile = 30 * 1000; // 30 seconds in milliseconds
    const estimatedTimeRemaining =
      (remainingFiles / activeJobs) * avgTimePerFile;

    return new Date(Date.now() + estimatedTimeRemaining);
  }

  /**
   * Mark a library scan as failed
   */
  markLibraryScanFailed(libraryId: string, libraryName: string): void {


    this.libraryScanTotals.delete(libraryId);
    this.logger.log(`Marked scan as failed for library ${libraryId}`);
  }

  /**
   * Clear progress tracking for a library
   */
  clearLibraryProgress(libraryId: string): void {
    this.libraryScanTotals.delete(libraryId);
    this.logger.log(`Cleared progress tracking for library ${libraryId}`);
  }
}
