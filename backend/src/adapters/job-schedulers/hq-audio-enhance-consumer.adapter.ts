import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { HqAudioEnhanceJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { EnhanceHqAudioUseCase } from 'src/application/use-cases/music-track/EnhanceHqAudio';
import { als } from 'src/kernel/types/context';

@Processor('hq-audio-enhance')
export class HqAudioEnhanceConsumerAdapter extends WorkerHost {
  constructor(private readonly enhanceHqAudioUseCase: EnhanceHqAudioUseCase) {
    super();
  }

  async process(job: Job<HqAudioEnhanceJobData>): Promise<void> {
    const { contextUser, trackId } = job.data;
    return als.run({ now: new Date(), user: contextUser }, async () => {
      switch (job.name) {
        case 'hq-audio-enhance':
          await this.enhanceHqAudioUseCase.execute(trackId);
          break;
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    });
  }
}
