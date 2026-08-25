import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmbeddingBackfillJobData } from 'src/application/ports/dtos/JobSchedulersData';
import {
  AUDIO_ANALYSIS_REPOSITORY,
  IAudioAnalysisRepository,
} from 'src/application/ports/repositories/IAudioAnalysisRepository';
import {
  AUDIO_ANALYSIS_STRUCTURE,
  IAudioAnalysisStructure,
} from 'src/application/ports/infrastructure/IAudioAnalysisStructure';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { als } from 'src/kernel/types/context';

const EMBEDDING_BACKFILL_CONCURRENCY = parseInt(
  process.env.EMBEDDING_BACKFILL_CONCURRENCY || '8',
  10,
);

@Processor('embedding-backfill', { concurrency: EMBEDDING_BACKFILL_CONCURRENCY })
export class EmbeddingBackfillConsumerAdapter extends WorkerHost {
  constructor(
    @Inject(AUDIO_ANALYSIS_STRUCTURE)
    private readonly audioAnalysisStructure: IAudioAnalysisStructure,
    @Inject(AUDIO_ANALYSIS_REPOSITORY)
    private readonly audioAnalysisRepository: IAudioAnalysisRepository,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    super();
    this.logger = loggerFactory.createLogger('EmbeddingBackfillConsumerAdapter');
  }

  async process(job: Job<EmbeddingBackfillJobData>): Promise<void> {
    const { trackId, filePath, contextUser } = job.data;
    return als.run({ now: new Date(), user: contextUser }, async () => {
      switch (job.name) {
        case 'embedding-backfill-track':
          await this.processTrack(trackId, filePath);
          break;
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    });
  }

  private async processTrack(trackId: EmbeddingBackfillJobData['trackId'], filePath: string) {
    try {
      const { embedding } = await this.audioAnalysisStructure.extractDiscogsEmbedding(filePath);
      if (embedding.length === 0) {
        this.logger.warn(`Discogs embedding extraction returned empty for track ${trackId}`, {
          trackId,
          filePath,
        });
        return;
      }
      await this.audioAnalysisRepository.updateEmbedding(trackId, embedding);
    } catch (error) {
      this.logger.error(`Embedding backfill failed for track ${trackId}`, { trackId, error });
    }
  }
}
