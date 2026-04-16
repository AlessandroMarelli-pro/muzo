import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { HqAudioAcquireJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { IHqAudioAcquireProducer } from 'src/application/ports/infrastructure/IHqAudioAcquireProducer';
import { MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';

@Injectable()
export class HqAudioAcquireProducerAdapter implements IHqAudioAcquireProducer {
  constructor(
    @InjectQueue('hq-audio-acquire')
    private readonly queue: Queue<HqAudioAcquireJobData>,
  ) {}

  async scheduleHqAudioAcquire(trackId: MusicTrackId, contextUser: ActionContext['user']): Promise<void> {
    await this.queue.add('hq-audio-acquire', { trackId, contextUser });
  }
}
