import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AudioScanBatchJobData } from 'src/clean-arch/application/ports/dtos/JobSchedulersData';
import { IAudioScanSchedulerConsumer } from 'src/clean-arch/application/ports/infrastructure/IAudioScanSchedulerConsumer';
import { AddImageSearchRecordUseCase } from 'src/clean-arch/application/use-cases/image/AddImageSearchRecord';
import { ProcessBatchAudioScanUseCase } from 'src/clean-arch/application/use-cases/job-scheduler/ProcessBatchAudioScan';
import { ProcessEndBatchAudioScanUseCase } from 'src/clean-arch/application/use-cases/job-scheduler/ProcessEndBatchAudioScan';
import { ProcessSingleTrackAnalysisUseCase } from 'src/clean-arch/application/use-cases/job-scheduler/ProcessSingleTrackAnalysis';
import { als } from 'src/clean-arch/kernel/types/context';

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
  ) {
    super();
  }

  async process(job: Job<AudioScanBatchJobData>): Promise<void> {
    const { sessionId, contextUser } = job.data;
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
    const { isBatchComplete, analysisResults, files, createdTracks } =
      await this.processBatchAudioScanUseCase.execute(data);
    if (!isBatchComplete) {
      for (const [index, track] of createdTracks.entries()) {
        const analysisResult = analysisResults.find(
          (result) => result.file_info.filename === track.fileInfo.fileName,
        );
        if (!analysisResult) {
          continue;
        }
        await this.processSingleTrackAnalysisUseCase.execute(
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
      }
    }
    await this.processEndBatchAudioScanUseCase.execute(
      data,
      data.libraryId,
      false,
      data.contextUser,
      data.totalFiles,
    );
  }
}
