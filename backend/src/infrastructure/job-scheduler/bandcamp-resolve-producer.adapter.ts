import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { BandcampResolveJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { IBandcampResolveProducer } from 'src/application/ports/infrastructure/IBandcampResolveProducer';
import { MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';

@Injectable()
export class BandcampResolveProducerAdapter implements IBandcampResolveProducer {
  constructor(
    @InjectQueue('bandcamp-resolve')
    private readonly queue: Queue<BandcampResolveJobData>,
  ) {}

  async scheduleBandcampResolve(trackId: MusicTrackId, contextUser: ActionContext['user']): Promise<void> {
    await this.queue.add('bandcamp-resolve', { trackId, contextUser });
  }
}
