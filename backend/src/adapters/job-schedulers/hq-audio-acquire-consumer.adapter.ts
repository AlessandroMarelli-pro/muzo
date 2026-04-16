import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { HqAudioAcquireJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { AcquireHqAudioUseCase } from 'src/application/use-cases/music-track/AcquireHqAudio';
import { als } from 'src/kernel/types/context';

@Processor('hq-audio-acquire')
export class HqAudioAcquireConsumerAdapter extends WorkerHost {
  constructor(private readonly acquireHqAudioUseCase: AcquireHqAudioUseCase) {
    super();
  }

  async process(job: Job<HqAudioAcquireJobData>): Promise<void> {
    const { contextUser, trackId } = job.data;
    return als.run({ now: new Date(), user: contextUser }, async () => {
      switch (job.name) {
        case 'hq-audio-acquire':
          await this.acquireHqAudioUseCase.execute(trackId);
          break;
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    });
  }
}
