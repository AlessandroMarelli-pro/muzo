import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AudioScanBatchJobData } from 'src/clean-arch/application/ports/dtos/JobSchedulersData';
import { IAudioScanSchedulerConsumer } from 'src/clean-arch/application/ports/infrastructure/IAudioScanSchedulerConsumer';
import { SessionId } from 'src/clean-arch/kernel/ids';
import { als } from 'src/clean-arch/kernel/types/context';

@Processor('audio-scan')
export class AudioScanSchedulerConsumerAdapter
  extends WorkerHost
  implements IAudioScanSchedulerConsumer
{
  constructor() {
    super();
  }

  async process(job: Job<AudioScanBatchJobData>): Promise<void> {
    const { sessionId, contextUser } = job.data;
    console.log('consumeBatchAudioScan', sessionId);
    return als.run({ now: new Date(), user: contextUser }, async () => {
      switch (job.name) {
        case 'audio-scan-batch':
          await job.updateProgress(0);
          await this.consumeBatchAudioScan(sessionId);
          await job.updateProgress(100);
          break;
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    });
  }
  consumeBatchAudioScan(sessionId: SessionId): Promise<void> {
    console.log('consumeBatchAudioScan', sessionId);
    throw new Error('Method not implemented.');
  }
}
