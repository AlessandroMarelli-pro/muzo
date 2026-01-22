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
}
export interface AIMetadataJobData {
  trackId: string;
  filePath: string;
  fileName: string;
  libraryId: string;
  index?: number;
  totalFiles?: number;
}

export interface BPMUpdateJobData {
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
      AudioScanJobData | EndScanLibraryJobData | AIMetadataJobData | AudioScanBatchJobData
    >,
    @InjectQueue('bpm-update')
    private readonly bpmUpdateQueue: Queue<BPMUpdateJobData>,
    private readonly configService: ConfigService,
    private readonly scanSessionService: ScanSessionService,
    private readonly pubSubService: ScanProgressPubSubService,
  ) {
    this.queueConfig = this.configService.get<QueueConfig>('queue');
  }

  /**
   * Schedule a library scan job
   * Returns the sessionId for progress tracking
   */
  async scheduleLibraryScan(
    libraryId: string,
    rootPath: string,
    libraryName: string,
  ): Promise<string> {
    try {

      // Create scan session
      const { sessionId } = await this.scanSessionService.createSession(libraryId);

      const jobData: LibraryScanJobData = {
        libraryId,
        rootPath,
        libraryName,
        sessionId,
      };

      await this.libraryScanQueue.add('scan-library', jobData, {
        attempts: this.queueConfig.queues.libraryScan.attempts,
        backoff: {
          type: this.queueConfig.queues.libraryScan.backoff.type as any,
          delay: this.queueConfig.queues.libraryScan.backoff.delay,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(
        `Scheduled library scan for: ${libraryName} (${rootPath}) with session: ${sessionId}`,
      );

      return sessionId;
    } catch (error) {
      this.logger.error(
        `Failed to schedule library scan for ${libraryName}:`,
        error,
      );
      throw error;
    }
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
      const BATCH_SIZE = 5;
      const totalBatches = Math.ceil(audioFiles.length / BATCH_SIZE);

      // Update session with total batches and tracks
      await this.scanSessionService.updateSessionProgress(sessionId, {
        totalBatches,
        totalTracks: audioFiles.length,
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
          libraryId
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
            removeOnComplete: true,
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
        removeOnComplete: true,
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

  /**
   * Schedule a BPM update job for a single track
   */
  async scheduleBPMUpdate(
    trackId: string,
    filePath: string,
    fileName: string,
    libraryId: string,
  ): Promise<void> {
    try {
      const jobData: BPMUpdateJobData = {
        trackId,
        filePath,
        fileName,
        libraryId,
      };

      await this.bpmUpdateQueue.add('update-bpm', jobData, {
        attempts: this.queueConfig.queues.audioScan.attempts, // Use same config as audio scan
        backoff: {
          type: this.queueConfig.queues.audioScan.backoff.type as any,
          delay: this.queueConfig.queues.audioScan.backoff.delay,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`Scheduled BPM update for: ${fileName}`);
    } catch (error) {
      this.logger.error(
        `Failed to schedule BPM update for ${fileName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Schedule BPM updates for multiple tracks in batch
   */
  async scheduleBatchBPMUpdates(
    tracks: Array<{
      trackId: string;
      filePath: string;
      fileName: string;
      libraryId: string;
    }>,
  ): Promise<void> {
    try {
      const jobs = tracks.map((track, index) => ({
        name: 'update-bpm',
        data: {
          trackId: track.trackId,
          filePath: track.filePath,
          fileName: track.fileName,
          libraryId: track.libraryId,

          index,
          totalFiles: tracks.length,
        } as BPMUpdateJobData,
        opts: {
          attempts: this.queueConfig.queues.audioScan.attempts,
          backoff: {
            type: this.queueConfig.queues.audioScan.backoff.type as any,
            delay: this.queueConfig.queues.audioScan.backoff.delay,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }));

      await this.bpmUpdateQueue.addBulk(jobs);

      this.logger.log(
        `Scheduled batch BPM updates for ${tracks.length} tracks`,
      );
    } catch (error) {
      this.logger.error(`Failed to schedule batch BPM updates:`, error);
      throw error;
    }
  }

  /**
   * Schedule BPM updates for all tracks in a library
   */
  async scheduleLibraryBPMUpdate(libraryId: string): Promise<void> {
    try {
      // This method will be implemented to fetch tracks from database
      // and schedule BPM updates for all tracks in the library
      this.logger.log(`Scheduling BPM updates for library: ${libraryId}`);

      // TODO: Implement database query to get all tracks in library
      // For now, this is a placeholder
      throw new Error('Library BPM update not yet implemented');
    } catch (error) {
      this.logger.error(
        `Failed to schedule library BPM update for ${libraryId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    libraryScan: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    audioScan: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    bpmUpdate: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  }> {
    try {
      const [libraryScanStats, audioScanStats, bpmUpdateStats] =
        await Promise.all([
          this.libraryScanQueue.getJobCounts(),
          this.audioScanQueue.getJobCounts(),
          this.bpmUpdateQueue.getJobCounts(),
        ]);

      return {
        libraryScan: {
          waiting: libraryScanStats.waiting,
          active: libraryScanStats.active,
          completed: libraryScanStats.completed,
          failed: libraryScanStats.failed,
        },
        audioScan: {
          waiting: audioScanStats.waiting,
          active: audioScanStats.active,
          completed: audioScanStats.completed,
          failed: audioScanStats.failed,
        },
        bpmUpdate: {
          waiting: bpmUpdateStats.waiting,
          active: bpmUpdateStats.active,
          completed: bpmUpdateStats.completed,
          failed: bpmUpdateStats.failed,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get queue stats:', error);
      throw error;
    }
  }

  /**
   * Clear all jobs from queues
   */
  async clearAllQueues(): Promise<void> {
    try {
      await Promise.all([
        this.libraryScanQueue.obliterate({ force: true }),
        this.audioScanQueue.obliterate({ force: true }),
        this.bpmUpdateQueue.obliterate({ force: true }),
      ]);

      this.logger.log('Cleared all queues');
    } catch (error) {
      this.logger.error('Failed to clear queues:', error);
      throw error;
    }
  }

  /**
   * Pause all queues
   */
  async pauseAllQueues(): Promise<void> {
    try {
      await Promise.all([
        this.libraryScanQueue.pause(),
        this.audioScanQueue.pause(),
        this.bpmUpdateQueue.pause(),
      ]);

      this.logger.log('Paused all queues');
    } catch (error) {
      this.logger.error('Failed to pause queues:', error);
      throw error;
    }
  }

  /**
   * Resume all queues
   */
  async resumeAllQueues(): Promise<void> {
    try {
      await Promise.all([
        this.libraryScanQueue.resume(),
        this.audioScanQueue.resume(),
        this.bpmUpdateQueue.resume(),
      ]);

      this.logger.log('Resumed all queues');
    } catch (error) {
      this.logger.error('Failed to resume queues:', error);
      throw error;
    }
  }

  /**
   * Schedule AI metadata extraction job for a single track
   */
  async scheduleAIMetadataExtraction(
    trackId: string,
    filePath: string,
    fileName: string,
    libraryId: string,
  ): Promise<void> {
    try {
      const jobData: AIMetadataJobData = {
        trackId,
        filePath,
        fileName,
        libraryId,
      };

      await this.audioScanQueue.add('extract-ai-metadata', jobData, {
        attempts: this.queueConfig.queues.audioScan.attempts,
        backoff: {
          type: this.queueConfig.queues.audioScan.backoff.type as any,
          delay: this.queueConfig.queues.audioScan.backoff.delay,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`Scheduled AI metadata extraction for: ${fileName}`);
    } catch (error) {
      this.logger.error(
        `Failed to schedule AI metadata extraction for ${fileName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Schedule AI metadata extraction for multiple tracks in batch
   */
  async scheduleBatchAIMetadataExtraction(
    tracks: Array<{
      trackId: string;
      filePath: string;
      fileName: string;
      libraryId: string;
    }>,
  ): Promise<void> {
    try {
      const jobs = tracks.map((track, index) => ({
        name: 'extract-ai-metadata',
        data: {
          trackId: track.trackId,
          filePath: track.filePath,
          fileName: track.fileName,
          libraryId: track.libraryId,
          index,
          totalFiles: tracks.length,
        } as AIMetadataJobData,
        opts: {
          attempts: this.queueConfig.queues.audioScan.attempts,
          backoff: {
            type: this.queueConfig.queues.audioScan.backoff.type as any,
            delay: this.queueConfig.queues.audioScan.backoff.delay,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }));

      await this.audioScanQueue.addBulk(jobs);

      this.logger.log(
        `Scheduled batch AI metadata extraction for ${tracks.length} tracks`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to schedule batch AI metadata extraction:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Schedule audio scans for tracks with null originalArtist
   */
  async scheduleScanForMissingData(
    tracks: Array<{
      id: string;
      filePath: string;
      libraryId: string;
      fileName: string;
      fileSize: number;
    }>,
    skipImageSearch: boolean = true,
    forced: boolean = false,
  ): Promise<void> {
    try {
      const jobs = tracks.map((track, index) => ({
        name: 'scan-audio',
        data: {
          filePath: track.filePath,
          libraryId: track.libraryId,
          fileName: track.fileName,
          fileSize: track.fileSize,
          lastModified: new Date(), // Use current date as fallback
          trackIndex: index + 1,
          skipClassification: true,
          totalFiles: tracks.length,
          skipImageSearch,
          forced,
        } as AudioScanJobData,
        opts: {
          attempts: this.queueConfig.queues.audioScan.attempts,
          backoff: {
            type: this.queueConfig.queues.audioScan.backoff.type as any,
            delay: this.queueConfig.queues.audioScan.backoff.delay,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }));

      await this.audioScanQueue.addBulk(jobs);

      this.logger.log(
        `Scheduled audio scans for ${tracks.length} tracks with null originalArtist`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to schedule audio scans for null artist tracks:`,
        error,
      );
      throw error;
    }
  }

}
