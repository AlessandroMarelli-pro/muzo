import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AnalysisStatus } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import * as fs from 'fs';
import { AiIntegrationService } from '../../../modules/ai-integration/ai-integration.service';
import { PrismaService } from '../../../shared/services/prisma.service';
import { ProgressTrackingService } from '../progress-tracking.service';
import { BPMUpdateJobData } from '../queue.service';

@Processor('bpm-update')
export class BPMUpdateProcessor extends WorkerHost {
  private readonly logger = new Logger(BPMUpdateProcessor.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly aiIntegrationService: AiIntegrationService,
    private readonly progressTrackingService: ProgressTrackingService,
    @InjectQueue('bpm-update')
    private readonly bpmUpdateQueue: Queue<BPMUpdateJobData>,
  ) {
    super();
  }

  async process(job: Job<BPMUpdateJobData>): Promise<void> {
    const {
      trackId,
      filePath,
      fileName,
      libraryId,

      index,
      totalFiles,
    } = job.data;

    this.logger.log(
      `Starting BPM update for: ${fileName} (${index !== undefined ? `${index + 1}/${totalFiles}` : 'single'})`,
    );

    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`Audio file not found: ${filePath}`);
      }

      // Check if track exists
      const track = await this.prismaService.musicTrack.findUnique({
        where: { id: trackId },
        include: {
          audioFingerprint: true,
        },
      });

      if (!track) {
        throw new Error(`Track not found: ${trackId}`);
      }

      // Update analysis status to PROCESSING
      await this.prismaService.musicTrack.update({
        where: { id: trackId },
        data: {
          analysisStatus: AnalysisStatus.PROCESSING,
          analysisStartedAt: new Date(),
        },
      });

      // Detect BPM using AI service
      const bpmResult = await this.aiIntegrationService.detectBPM(filePath);

      // Update track with BPM result
      await this.updateTrackWithBPM(trackId, bpmResult);

      // Update analysis status to COMPLETED
      await this.prismaService.musicTrack.update({
        where: { id: trackId },
        data: {
          analysisStatus: AnalysisStatus.COMPLETED,
          analysisCompletedAt: new Date(),
        },
      });

      this.logger.log(
        `Successfully updated BPM for: ${fileName} (BPM: ${bpmResult.bpm})`,
      );

      // Update progress tracking
      const library = await this.prismaService.musicLibrary.findUnique({
        where: { id: libraryId },
        select: { name: true },
      });

      if (library) {
        await this.progressTrackingService.updateLibraryProgress(
          libraryId,
          library.name,
        );
      }

      // Update job progress
      await job.updateProgress(100);
    } catch (error) {
      this.logger.error(`BPM update failed for ${fileName}:`, error.message);

      // Update track with error status
      try {
        await this.prismaService.musicTrack.update({
          where: { id: trackId },
          data: {
            analysisStatus: AnalysisStatus.FAILED,
            analysisError: error.message,
          },
        });
      } catch (updateError) {
        this.logger.error(
          'Failed to update track error status:',
          updateError.message,
        );
      }

      throw error;
    }
  }

  /**
   * Update track with BPM detection results
   */
  private async updateTrackWithBPM(trackId: string, bpmResult: any) {
    const updateData: any = {};

    // Update BPM if available
    if (bpmResult.bpm !== undefined && bpmResult.bpm !== null) {
      updateData.detectedBpm = Math.round(bpmResult.bpm * 100) / 100; // Round to 2 decimal places
    }

    const updatedTrack = await this.prismaService.musicTrack.update({
      where: { id: trackId },
      data: {
        analysisCompletedAt: new Date(),
        analysisError: null,
      },
    });

    await this.prismaService.audioFingerprint.update({
      where: { trackId },
      data: {
        tempo: updateData.detectedBpm,
      },
    });

    return updatedTrack;
  }

  /**
   * Handle job failure
   */
  async onFailed(job: Job<BPMUpdateJobData>, error: Error): Promise<void> {
    this.logger.error(
      `BPM update job failed for ${job.data.fileName}:`,
      error.message,
    );
  }

  /**
   * Handle job completion
   */
  async onCompleted(job: Job<BPMUpdateJobData>): Promise<void> {
    this.logger.log(`BPM update completed for: ${job.data.fileName}`);
  }
}
