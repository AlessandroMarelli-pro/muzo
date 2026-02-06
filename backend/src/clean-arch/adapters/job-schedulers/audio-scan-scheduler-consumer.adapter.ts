import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AudioScanBatchJobData } from 'src/clean-arch/application/ports/dtos/JobSchedulersData';
import { IAudioScanSchedulerConsumer } from 'src/clean-arch/application/ports/infrastructure/IAudioScanSchedulerConsumer';
import { ProcessBatchAudioScanUseCase } from 'src/clean-arch/application/use-cases/job-scheduler/ProcessBatchAudioScan';
import { als } from 'src/clean-arch/kernel/types/context';

@Processor('audio-scan')
export class AudioScanSchedulerConsumerAdapter
  extends WorkerHost
  implements IAudioScanSchedulerConsumer
{
  constructor(
    private readonly processBatchAudioScanUseCase: ProcessBatchAudioScanUseCase,
  ) {
    super();
  }

  async process(job: Job<AudioScanBatchJobData>): Promise<void> {
    const { sessionId, contextUser } = job.data;
    console.log('consumeBatchAudioScan', sessionId);
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
    const { audioFiles, sessionId, batchIndex, contextUser } = data;
    await this.processBatchAudioScanUseCase.execute(
      audioFiles.map(({ path }) => path),
      sessionId,
      batchIndex,
      false,
    );
  }
}
