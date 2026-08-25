import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BulkJobOptions, Queue } from 'bullmq';
import { EmbeddingBackfillJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { IEmbeddingBackfillProducer } from 'src/application/ports/infrastructure/IEmbeddingBackfillProducer';
import { QueueConfig } from 'src/config';
import { MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';

@Injectable()
export class EmbeddingBackfillProducerAdapter implements IEmbeddingBackfillProducer {
  private readonly queueConfig: QueueConfig;

  constructor(
    @InjectQueue('embedding-backfill')
    private readonly queue: Queue<EmbeddingBackfillJobData>,
    private readonly configService: ConfigService,
  ) {
    this.queueConfig = this.configService.get<QueueConfig>('queue')!;
  }

  async scheduleEmbeddingBackfill(
    tracks: { trackId: MusicTrackId; filePath: string }[],
    contextUser: ActionContext['user'],
  ): Promise<{ jobCount: number }> {
    const jobs: { name: string; data: EmbeddingBackfillJobData; opts: BulkJobOptions }[] =
      tracks.map((track) => ({
        name: 'embedding-backfill-track',
        data: {
          trackId: track.trackId,
          filePath: track.filePath,
          contextUser,
        },
        opts: this.queueConfig.queues.embeddingBackfill,
      }));

    await this.queue.addBulk(jobs);
    return { jobCount: jobs.length };
  }
}
