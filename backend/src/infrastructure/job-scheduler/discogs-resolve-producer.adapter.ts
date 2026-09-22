import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DiscogsResolveJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { IDiscogsResolveProducer } from 'src/application/ports/infrastructure/IDiscogsResolveProducer';
import { MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';

@Injectable()
export class DiscogsResolveProducerAdapter implements IDiscogsResolveProducer {
  constructor(
    @InjectQueue('discogs-resolve')
    private readonly queue: Queue<DiscogsResolveJobData>,
  ) {}

  async scheduleDiscogsResolve(trackId: MusicTrackId, contextUser: ActionContext['user']): Promise<void> {
    await this.queue.add('discogs-resolve', { trackId, contextUser });
  }
}
