import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BulkJobOptions, Queue } from 'bullmq';
import { FileInfo } from 'src/application/ports/dtos/FileInfo';
import { AudioScanBatchJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { IAudioScanSchedulerProducer } from 'src/application/ports/infrastructure/IAudioScanSchedulerProducer';
import {
  IScanSessionRepository,
  SCAN_SESSION_REPOSITORY,
} from 'src/application/ports/repositories/IScanSessionRepository';
import { QueueConfig } from 'src/config';
import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';

@Injectable()
export class AudioScanSchedulerProducerAdapter
  implements IAudioScanSchedulerProducer
{
  private readonly queueConfig: QueueConfig;

  constructor(
    @InjectQueue('audio-scan')
    private readonly audioScanQueue: Queue<AudioScanBatchJobData>,
    private readonly configService: ConfigService,
    @Inject(SCAN_SESSION_REPOSITORY)
    private readonly scanSessionRepository: IScanSessionRepository,
  ) {
    this.queueConfig = this.configService.get<QueueConfig>('queue')!;
  }

  async scheduleBatchAudioScan(
    audioFiles: FileInfo[],
    libraryId: MusicLibraryId,
    sessionId: SessionId,
    contextUser: ActionContext['user'],
    incremental: boolean,
  ): Promise<{ sessionId: SessionId }> {
    const batchJobs: {
      name: string;
      data: AudioScanBatchJobData;
      opts: BulkJobOptions;
    }[] = [];

    const BATCH_SIZE = 10;
    const totalBatches = Math.ceil(audioFiles.length / BATCH_SIZE);
    await this.scanSessionRepository.updateSession(sessionId, {
      totalBatches,
      totalTracks: audioFiles.length,
    });
    // Create batches of 10 files
    for (let i = 0; i < audioFiles.length; i += BATCH_SIZE) {
      const batch = audioFiles.slice(i, i + BATCH_SIZE);
      const batchIndex = Math.floor(i / BATCH_SIZE) + 1;

      const batchData: AudioScanBatchJobData = {
        startDateTS: Date.now(),
        audioFiles: batch.map((file, j) => ({
          ...file,
          libraryId,
          trackIndex: j + (batchIndex - 1) * BATCH_SIZE + 1,
        })),
        totalFiles: audioFiles.length,
        totalBatches,
        batchIndex,
        sessionId,
        contextUser,
        libraryId,
        incremental,
      };

      batchJobs.push({
        name: 'audio-scan-batch',
        data: batchData,
        opts: this.queueConfig.queues.audioScan,
      });
    }

    await this.audioScanQueue.addBulk(batchJobs);
    return { sessionId };
  }
}
