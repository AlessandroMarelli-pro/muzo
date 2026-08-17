import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { HqAudioEnhanceJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { IHqAudioEnhanceProducer } from 'src/application/ports/infrastructure/IHqAudioEnhanceProducer';
import { MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';

@Injectable()
export class HqAudioEnhanceProducerAdapter implements IHqAudioEnhanceProducer {
  constructor(
    @InjectQueue('hq-audio-enhance')
    private readonly queue: Queue<HqAudioEnhanceJobData>,
  ) {}

  async scheduleHqAudioEnhance(trackId: MusicTrackId, contextUser: ActionContext['user']): Promise<void> {
    await this.queue.add('hq-audio-enhance', { trackId, contextUser });
  }
}
