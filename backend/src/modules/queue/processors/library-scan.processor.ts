import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ScanStatus } from '@prisma/client';
import { Job } from 'bullmq';
import * as fs from 'fs';
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

@Processor('library-scan')
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
  ) {
    super();
  }

  async process(job: Job<LibraryScanJobData>): Promise<void> {
    const { libraryId, rootPath, libraryName } = job.data;

    this.logger.log(`Starting library scan for: ${libraryName} (${rootPath})`);

    try {
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

      // Schedule audio scan jobs for all found files
      await this.queueService.scheduleBatchAudioScans(audioFiles);

      this.logger.log(
        `Successfully scheduled ${audioFiles.length} audio scan jobs for library: ${libraryName}`,
      );

      // Update job progress
      await job.updateProgress(100);
    } catch (error) {
      this.logger.error(
        `Library scan failed for ${libraryName}:`,
        error.message,
      );

      // Mark scan as failed in progress tracking
      this.progressTrackingService.markLibraryScanFailed(
        libraryId,
        libraryName,
      );

      throw error;
    }
  }

  /**
   * Handle job failure
   */
  async onFailed(job: Job<LibraryScanJobData>, error: Error): Promise<void> {
    this.logger.error(
      `Library scan job failed for ${job.data.libraryName}:`,
      error.message,
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
    this.logger.log(`Library scan completed for: ${job.data.libraryName}`);

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
