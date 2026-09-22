import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BandcampResolveJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { ResolveBandcampUrlUseCase } from 'src/application/use-cases/music-track/ResolveBandcampUrl';
import { als } from 'src/kernel/types/context';

@Processor('bandcamp-resolve')
export class BandcampResolveConsumerAdapter extends WorkerHost {
  constructor(private readonly resolveBandcampUrlUseCase: ResolveBandcampUrlUseCase) {
    super();
  }

  async process(job: Job<BandcampResolveJobData>): Promise<void> {
    const { contextUser, trackId } = job.data;
    return als.run({ now: new Date(), user: contextUser }, async () => {
      switch (job.name) {
        case 'bandcamp-resolve':
          await this.resolveBandcampUrlUseCase.execute(trackId);
          break;
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    });
  }
}
