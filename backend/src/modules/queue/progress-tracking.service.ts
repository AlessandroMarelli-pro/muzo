import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Subject } from 'rxjs';

export interface LibraryScanProgress {
  libraryId: string;
  libraryName: string;
  totalFiles: number;
  processedFiles: number;
  remainingFiles: number;
  progressPercentage: number;
  status: 'SCANNING' | 'COMPLETED' | 'FAILED' | 'IDLE';
  estimatedCompletion?: Date;
}

@Injectable()
export class ProgressTrackingService {
  private readonly logger = new Logger(ProgressTrackingService.name);
  private readonly progressSubject = new Subject<LibraryScanProgress>();

  // Track initial file counts for each library scan
  private readonly libraryScanTotals = new Map<string, number>();

  constructor(
    @InjectQueue('audio-scan')
    private readonly audioScanQueue: Queue,
  ) {}

  /**
   * Get the progress stream for subscriptions
   */
  getProgressStream() {
    return this.progressSubject.asObservable();
  }

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
      const waitingJobs = await this.getWaitingJobsForLibrary(libraryId);
      const activeJobs = await this.getActiveJobsForLibrary(libraryId);

      const remainingFiles = waitingJobs + activeJobs;
      const processedFiles = totalFiles - remainingFiles + 1;
      const progressPercentage =
        totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0;

      // Determine status based on remaining files
      let status: LibraryScanProgress['status'] = 'SCANNING';
      if (remainingFiles === 0) {
        status = 'COMPLETED';
      }

      const progress: LibraryScanProgress = {
        libraryId,
        libraryName,
        totalFiles,
        processedFiles,
        remainingFiles,
        progressPercentage: Math.round(progressPercentage * 100) / 100,
        status,
        estimatedCompletion: this.calculateEstimatedCompletion(
          remainingFiles,
          activeJobs,
        ),
      };

      this.logger.debug(
        `Progress update for ${libraryName}: ${processedFiles}/${totalFiles} (${progressPercentage.toFixed(1)}%)`,
      );

      // Emit progress update
      this.progressSubject.next(progress);

      // Clean up completed scans
      if (status === 'COMPLETED') {
        this.libraryScanTotals.delete(libraryId);
        this.logger.log(
          `Completed scan for library ${libraryId}, cleaned up tracking`,
        );
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
  private async getWaitingJobsForLibrary(libraryId: string): Promise<number> {
    try {
      const waitingJobs = await this.audioScanQueue.getJobs(['waiting'], 0, -1);
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
   * Get active jobs count for a specific library
   */
  private async getActiveJobsForLibrary(libraryId: string): Promise<number> {
    try {
      const activeJobs = await this.audioScanQueue.getJobs(['active'], 0, -1);
      return activeJobs.filter(
        (job) =>
          job.data &&
          typeof job.data === 'object' &&
          'libraryId' in job.data &&
          job.data.libraryId === libraryId,
      ).length;
    } catch (error) {
      this.logger.error(
        `Failed to get active jobs for library ${libraryId}:`,
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
    const totalFiles = this.libraryScanTotals.get(libraryId) || 0;

    const progress: LibraryScanProgress = {
      libraryId,
      libraryName,
      totalFiles,
      processedFiles: 0,
      remainingFiles: totalFiles,
      progressPercentage: 0,
      status: 'FAILED',
    };

    this.progressSubject.next(progress);
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
