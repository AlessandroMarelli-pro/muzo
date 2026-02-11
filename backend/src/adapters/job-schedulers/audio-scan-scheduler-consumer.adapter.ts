import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { AudioScanBatchJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { IAudioScanSchedulerConsumer } from 'src/application/ports/infrastructure/IAudioScanSchedulerConsumer';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { AddImageSearchRecordUseCase } from 'src/application/use-cases/image/AddImageSearchRecord';
import { ProcessBatchAudioScanUseCase } from 'src/application/use-cases/job-scheduler/ProcessBatchAudioScan';
import { ProcessEndBatchAudioScanUseCase } from 'src/application/use-cases/job-scheduler/ProcessEndBatchAudioScan';
import { ProcessSingleTrackAnalysisUseCase } from 'src/application/use-cases/job-scheduler/ProcessSingleTrackAnalysis';
import { als } from 'src/kernel/types/context';

@Processor('audio-scan')
export class AudioScanSchedulerConsumerAdapter
  extends WorkerHost
  implements IAudioScanSchedulerConsumer
{
  constructor(
    private readonly processBatchAudioScanUseCase: ProcessBatchAudioScanUseCase,
    private readonly processSingleTrackAnalysisUseCase: ProcessSingleTrackAnalysisUseCase,
    private readonly addImageSearchRecordUseCase: AddImageSearchRecordUseCase,
    private readonly processEndBatchAudioScanUseCase: ProcessEndBatchAudioScanUseCase,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    super();
    this.logger = loggerFactory.createLogger(
      'AudioScanSchedulerConsumerAdapter',
    );
  }

  async process(job: Job<AudioScanBatchJobData>): Promise<void> {
    const { sessionId, contextUser } = job.data;
    this.logger.info(`Processing audio scan batch for session ${sessionId}`, {
      sessionId,
      contextUser,
      jobData: job.data,
    });
    return als.run({ now: new Date(), user: contextUser }, async () => {
      switch (job.name) {
        case 'audio-scan-batch':
          await job.updateProgress(0);
          await this.consumeBatchAudioScan(job.data);
          await job.updateProgress(100);
          break;
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    });
  }

  async consumeBatchAudioScan(data: AudioScanBatchJobData): Promise<void> {
    this.logger.info(
      `Consuming audio scan batch for session ${data.sessionId}`,
      {
        sessionId: data.sessionId,
        contextUser: data.contextUser,
        jobData: data,
      },
    );
    const { isBatchComplete, analysisResults, files, createdTracks } =
      await this.processBatchAudioScanUseCase.execute(data);
    this.logger.info(
      `Processed audio scan batch for session ${data.sessionId}`,
      {
        sessionId: data.sessionId,
        contextUser: data.contextUser,
        jobData: data,
        isBatchComplete,
        analysisResults: analysisResults.length,
        files: files.length,
        createdTracks: createdTracks.length,
      },
    );
    let successCount = 0;
    let failedCount = 0;
    if (!isBatchComplete) {
      await Promise.all(
        createdTracks.map(async (track, index) => {
          const analysisResult = analysisResults.find(
            (result) => result.file_info.filename === track.fileInfo.fileName,
          );
          if (!analysisResult) {
            this.logger.warn(
              `Analysis result not found for track ${track.id} ${track.fileInfo.fileName}`,
            );
            return;
          }
          const result = await this.processSingleTrackAnalysisUseCase.execute(
            track,
            analysisResult,
            {
              trackIndex: index,
              sessionId: data.sessionId,
              batchIndex: data.batchIndex,
              totalTracks: data.totalFiles,
              libraryId: track.libraryId,
            },
          );
          if (result.isSuccess) {
            successCount++;
          } else {
            failedCount++;
          }
          // Search for image if available
          if (
            analysisResult.album_art?.imageUrl ||
            analysisResult.album_art?.imagePath
          ) {
            await this.addImageSearchRecordUseCase.execute(track.id, {
              imagePath: analysisResult.album_art.imagePath,
              imageUrl: analysisResult.album_art.imageUrl,
              source: analysisResult.album_art.source,
            });
          }
        }),
      );
    }
    this.logger.info(
      `Processing end batch audio scan for session ${data.sessionId}`,
      {
        sessionId: data.sessionId,
        contextUser: data.contextUser,
        jobData: data,
        isBatchComplete,
        analysisResults: analysisResults.length,
        files: files.length,
        createdTracks: createdTracks.length,
        successCount,
        failedCount,
      },
    );
    await this.processEndBatchAudioScanUseCase.execute(
      data,
      data.libraryId,
      false,
      data.contextUser,
      data.totalFiles,
    );
  }
}
