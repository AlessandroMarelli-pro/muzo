import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DiscogsResolveJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { ResolveDiscogsUrlUseCase } from 'src/application/use-cases/music-track/ResolveDiscogsUrl';
import { als } from 'src/kernel/types/context';

@Processor('discogs-resolve')
export class DiscogsResolveConsumerAdapter extends WorkerHost {
  constructor(private readonly resolveDiscogsUrlUseCase: ResolveDiscogsUrlUseCase) {
    super();
  }

  async process(job: Job<DiscogsResolveJobData>): Promise<void> {
    const { contextUser, trackId } = job.data;
    return als.run({ now: new Date(), user: contextUser }, async () => {
      switch (job.name) {
        case 'discogs-resolve':
          await this.resolveDiscogsUrlUseCase.execute(trackId);
          break;
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    });
  }
}
