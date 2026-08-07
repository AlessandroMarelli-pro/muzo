import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { HqAudioBatchAcquireJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { IHqAudioBatchAcquireProducer } from 'src/application/ports/infrastructure/IHqAudioBatchAcquireProducer';
import { HqAudioBatchId, MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';

@Injectable()
export class HqAudioBatchAcquireProducerAdapter implements IHqAudioBatchAcquireProducer {
  constructor(
    @InjectQueue('hq-audio-batch-acquire')
    private readonly queue: Queue<HqAudioBatchAcquireJobData>,
  ) {}

  async scheduleBatch(
    batchId: HqAudioBatchId,
    trackIds: MusicTrackId[],
    contextUser: ActionContext['user'],
  ): Promise<void> {
    await this.queue.add('hq-audio-batch-acquire', { batchId, trackIds, contextUser });
  }
}
