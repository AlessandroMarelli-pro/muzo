import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScanStatus } from '@prisma/client';
import { Job } from 'bullmq';
import * as fs from 'fs';
import { QueueConfig } from 'src/config/queue.config';
import { FileScanningService } from 'src/shared/services/file-scanning.service';
import { PrismaService } from '../../../shared/services/prisma.service';
import { ProgressTrackingService } from '../progress-tracking.service';
import { LibraryScanJobData, QueueService } from '../queue.service';

export interface AudioFile {
  filePath: string;
  libraryId: string;
  fileName: string;
  fileSize: number;
  lastModified: Date;
}

@Processor('library-scan', {
  concurrency: parseInt(process.env.LIBRARY_SCAN_CONCURRENCY || '1', 10),
})
export class LibraryScanProcessor extends WorkerHost {
  private readonly logger = new Logger(LibraryScanProcessor.name);
  private readonly supportedAudioExtensions = [
    '.wav',
    '.mp3',
    '.flac',
    '.m4a',
    '.aac',
    '.ogg',
    '.wma',
    '.m4p',
    '.aiff',
    '.au',
    '.opus',
  ];

  constructor(
    private readonly queueService: QueueService,
    private readonly prismaService: PrismaService,
    private readonly progressTrackingService: ProgressTrackingService,
    private readonly fileScanningService: FileScanningService,
    private readonly configService: ConfigService,
  ) {
    super();
    const queueConfig = this.configService.get<QueueConfig>('queue');
    this.logger.log(
      `LibraryScanProcessor initialized and ready to process jobs from 'library-scan' queue with concurrency: ${queueConfig.queues.libraryScan.concurrency}`,
    );
  }

  async process(job: Job<LibraryScanJobData>): Promise<void> {
    const { libraryId, rootPath, libraryName, sessionId } = job.data;

    this.logger.log(
      `[JOB ${job.id}] Starting library scan for: ${libraryName} (${rootPath})`,
    );

    try {
      // Ensure job is in active state
      await job.updateProgress(0);
      // Validate that the root path exists
      if (!fs.existsSync(rootPath)) {
        throw new Error(`Library root path does not exist: ${rootPath}`);
      }

      // Get all audio files in the library
      const audioFiles = await this.fileScanningService.incrementalScan(
        libraryId,
        {
          recursive: true,
        },
      );
      this.logger.log(
        `Found ${audioFiles.length} audio files in library: ${libraryName}`,
      );

      if (audioFiles.length === 0) {
        this.logger.warn(`No audio files found in library: ${libraryName}`);
        return;
      }

      // Set the total files for progress tracking
      this.progressTrackingService.setLibraryScanTotal(
        libraryId,
        audioFiles.length,
      );

      // Schedule audio scan jobs for all found files (pass sessionId if available)
      await this.queueService.scheduleBulkBatchAudioScans(
        audioFiles,
        false,
        false,
        libraryId,
      );

      this.logger.log(
        `[JOB ${job.id}] Successfully scheduled ${audioFiles.length} audio scan jobs for library: ${libraryName}${sessionId ? ` with session: ${sessionId}` : ''}`,
      );
      // Update job progress to completion
      await job.updateProgress(100);
      this.logger.log(
        `[JOB ${job.id}] Library scan completed successfully for: ${libraryName}`,
      );
    } catch (error) {
      this.logger.error(
        `[JOB ${job.id}] Library scan failed for ${libraryName}:`,
        error.message,
        error.stack,
      );

      // Mark scan as failed in progress tracking
      this.progressTrackingService.markLibraryScanFailed(
        libraryId,
        libraryName,
      );

      // Re-throw to ensure job is marked as failed
      throw error;
    }
  }

  /**
   * Handle job failure
   */
  async onFailed(job: Job<LibraryScanJobData>, error: Error): Promise<void> {
    this.logger.error(
      `[JOB ${job.id}] Library scan job failed for ${job.data.libraryName}:`,
      error.message,
      error.stack,
    );

    // Update library scan status to IDLE on failure
    try {
      await this.prismaService.musicLibrary.update({
        where: { id: job.data.libraryId },
        data: { scanStatus: ScanStatus.IDLE },
      });
    } catch (updateError) {
      this.logger.error(
        'Failed to update library scan status on failure:',
        updateError.message,
      );
    }
  }

  /**
   * Handle job completion
   */
  async onCompleted(job: Job<LibraryScanJobData>): Promise<void> {
    this.logger.log(
      `[JOB ${job.id}] Library scan job completed successfully for: ${job.data.libraryName}`,
    );

    // Update library scan status to IDLE and update last scan timestamp
    try {
      await this.prismaService.musicLibrary.update({
        where: { id: job.data.libraryId },
        data: {
          scanStatus: ScanStatus.IDLE,
          lastScanAt: new Date(),
        },
      });
    } catch (updateError) {
      this.logger.error(
        'Failed to update library scan status on completion:',
        updateError.message,
      );
    }
  }



}
