import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { HqAudioBatchAcquireJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { AcquireHqAudioBatchUseCase } from 'src/application/use-cases/hq-audio-batch/AcquireHqAudioBatch';
import { als } from 'src/kernel/types/context';

@Processor('hq-audio-batch-acquire')
export class HqAudioBatchAcquireConsumerAdapter extends WorkerHost {
  constructor(private readonly acquireHqAudioBatchUseCase: AcquireHqAudioBatchUseCase) {
    super();
  }

  async process(job: Job<HqAudioBatchAcquireJobData>): Promise<void> {
    const { contextUser, trackIds, batchId } = job.data;
    return als.run({ now: new Date(), user: contextUser }, async () => {
      switch (job.name) {
        case 'hq-audio-batch-acquire':
          await this.acquireHqAudioBatchUseCase.execute(batchId, trackIds);
          break;
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    });
  }
}
