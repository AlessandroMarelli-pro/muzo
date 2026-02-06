import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { QueueConfig } from '../../config';
import { ScanProgressPubSubService } from './scan-progress-pubsub.service';
import { BatchCreatedEvent } from './scan-progress.types';
import { ScanSessionService } from './scan-session.service';

export interface LibraryScanJobData {
  libraryId: string;
  rootPath: string;
  libraryName: string;
  sessionId?: string; // Optional for backward compatibility
}
interface AudioScanJobDataBase {
  filePath: string;
  libraryId: string;
  fileName: string;
  fileSize: number;
  lastModified: Date;
  trackIndex: number;
}
export interface AudioScanJobData extends AudioScanJobDataBase {
  skipClassification?: boolean;
  skipImageSearch?: boolean;
  skipAIMetadata?: boolean;
  totalFiles?: number;
  forced?: boolean;
}

export interface AudioScanBatchJobData {
  audioFiles: AudioScanJobDataBase[];
  forced?: boolean;
  totalBatches?: number;
  batchIndex?: number;
  sessionId?: string; // Session ID for progress tracking
  totalFiles?: number;
  skipClassification?: boolean;
  skipImageSearch?: boolean;
  skipAIMetadata?: boolean;
  libraryId: string;
  startDateTS: number;
}
export interface AIMetadataJobData {
  trackId: string;
  filePath: string;
  fileName: string;
  libraryId: string;
  index?: number;
  totalFiles?: number;
}

export interface EndScanLibraryJobData {
  libraryId: string;
  libraryName: string;
  totalTracks: number;
  scanType: 'full' | 'incremental';
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queueConfig: QueueConfig;

  constructor(
    @InjectQueue('library-scan')
    private readonly libraryScanQueue: Queue<LibraryScanJobData>,
    @InjectQueue('audio-scan')
    private readonly audioScanQueue: Queue<
      | AudioScanJobData
      | EndScanLibraryJobData
      | AIMetadataJobData
      | AudioScanBatchJobData
    >,
    private readonly configService: ConfigService,
    private readonly scanSessionService: ScanSessionService,
    private readonly pubSubService: ScanProgressPubSubService,
  ) {
    this.queueConfig = this.configService.get<QueueConfig>('queue');
  }

  /**
   * Schedule multiple audio file scans in batches of 10 files using audio-scan-batch
   * @param audioFiles - Array of audio files to scan
   * @param sessionId - Optional session ID (if not provided, will be created)
   */
  async scheduleBulkBatchAudioScans(
    audioFiles: Array<{
      filePath: string;
      libraryId: string;
      fileName: string;
      fileSize: number;
      lastModified: Date;
    }>,
    skipImageSearch: boolean = false,
    forced: boolean = false,
    libraryId: string,
  ): Promise<string> {
    try {
      const sessionId = libraryId;
      const BATCH_SIZE = 10;
      const totalBatches = Math.ceil(audioFiles.length / BATCH_SIZE);

      // Update session with total batches and tracks
      await this.scanSessionService.updateSessionProgress(sessionId, {
        totalBatches,
        totalTracks: audioFiles.length,
        progressPercentage: 0,
        completedBatches: 0,
      });

      // Publish batch.created event
      const batchCreatedEvent: BatchCreatedEvent = {
        type: 'batch.created',
        sessionId,
        timestamp: new Date().toISOString(),
        data: {
          totalBatches,
          totalTracks: audioFiles.length,
        },
        overallProgress: 0,
      };
      await this.pubSubService.publishEvent(sessionId, batchCreatedEvent);

      const batchJobs = [];

      // Create batches of 10 files
      for (let i = 0; i < audioFiles.length; i += BATCH_SIZE) {
        const batch = audioFiles.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        const batchData: AudioScanBatchJobData = {
          startDateTS: Date.now(),
          audioFiles: batch.map((file, j) => ({
            filePath: file.filePath,
            libraryId: file.libraryId,
            fileName: file.fileName,
            fileSize: file.fileSize,
            lastModified: file.lastModified,
            trackIndex: j + (batchIndex - 1) * BATCH_SIZE + 1,
          })),
          skipImageSearch,
          forced,
          sessionId,
          totalFiles: audioFiles.length,
          totalBatches,
          batchIndex,
          libraryId,
        };

        batchJobs.push({
          name: 'audio-scan-batch',
          data: batchData,
          opts: {
            attempts: this.queueConfig.queues.audioScan.attempts,
            backoff: {
              type: this.queueConfig.queues.audioScan.backoff.type as any,
              delay: this.queueConfig.queues.audioScan.backoff.delay,
            },
            removeOnComplete: false,
            removeOnFail: false,
          },
        });
        this.logger.log(
          `Scheduled batch audio scan job for ${batch.length} files  (${batchIndex}/${totalBatches})`,
        );
      }

      await this.audioScanQueue.addBulk(batchJobs);

      this.logger.log(
        `Scheduled ${batchJobs.length} batch audio scan jobs for ${audioFiles.length} files (${BATCH_SIZE} files per batch) with session: ${sessionId}`,
      );

      return sessionId;
    } catch (error) {
      this.logger.error(`Failed to schedule batch audio scans:`, error);
      throw error;
    }
  }

  /**
   * Schedule an end-scan-library job
   */
  async scheduleEndScanLibrary(
    libraryId: string,
    libraryName: string,
    totalTracks: number,
    scanType: 'full' | 'incremental',
  ): Promise<void> {
    try {
      const jobData: EndScanLibraryJobData = {
        libraryId,
        libraryName,
        totalTracks,
        scanType,
      };

      await this.audioScanQueue.add('end-scan-library', jobData, {
        attempts: this.queueConfig.queues.audioScan.attempts,
        backoff: {
          type: this.queueConfig.queues.audioScan.backoff.type as any,
          delay: this.queueConfig.queues.audioScan.backoff.delay,
        },
        removeOnComplete: false,
        removeOnFail: false,
      });

      this.logger.log(
        `Scheduled end-scan-library job for: ${libraryName} (${totalTracks} tracks)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to schedule end-scan-library job for ${libraryName}:`,
        error,
      );
      throw error;
    }
  }
}
