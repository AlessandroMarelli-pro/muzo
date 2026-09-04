import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmbeddingBackfillJobData } from 'src/application/ports/dtos/JobSchedulersData';
import {
  AUDIO_ANALYSIS_STRUCTURE,
  IAudioAnalysisStructure,
} from 'src/application/ports/infrastructure/IAudioAnalysisStructure';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import {
  AUDIO_ANALYSIS_REPOSITORY,
  IAudioAnalysisRepository,
} from 'src/application/ports/repositories/IAudioAnalysisRepository';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from 'src/application/ports/repositories/IMusicTrackRepository';
import { als } from 'src/kernel/types/context';

/**
 * Every job in this queue calls extractDiscogsEmbedding, which goes through
 * AiServerPoolAdapter.getTarget() -- round-robined across every healthy ai-service
 * instance (see ai-server-pool.adapter.ts), so concurrent jobs here do spread
 * across replicas in local mode. In remote (single-URL) mode there is still only
 * one instance to send to, so this default stays modest regardless.
 */
const EMBEDDING_BACKFILL_CONCURRENCY = parseInt(
  process.env.EMBEDDING_BACKFILL_CONCURRENCY || '3',
  10,
);

@Processor('embedding-backfill', { concurrency: EMBEDDING_BACKFILL_CONCURRENCY })
export class EmbeddingBackfillConsumerAdapter extends WorkerHost {
  constructor(
    @Inject(AUDIO_ANALYSIS_STRUCTURE)
    private readonly audioAnalysisStructure: IAudioAnalysisStructure,
    @Inject(AUDIO_ANALYSIS_REPOSITORY)
    private readonly audioAnalysisRepository: IAudioAnalysisRepository,
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,
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
      // Check current state first so an already-computed embedding/classifiers set isn't
      // silently overwritten by a re-run of this job (e.g. after a broader backfill sweep
      // picks up tracks that already have one piece but not the other).
      const track = await this.musicTrackRepository.getOneById(trackId);
      const existingEmbedding = track.features?.embedding;
      const hasEmbedding = Array.isArray(existingEmbedding) && existingEmbedding.length > 0;
      const hasClassifiers = track.features?.musicalFeatures?.voice != null;

      if (hasEmbedding && hasClassifiers) {
        this.logger.info(`Skipping track ${trackId}: embedding and classifiers already present`, {
          trackId,
        });
        return;
      }

      const { embedding, discogsClassifiers, discogsTempo } =
        await this.audioAnalysisStructure.extractDiscogsEmbedding(filePath);
      if (embedding.length === 0) {
        this.logger.warn(`Discogs embedding extraction returned empty for track ${trackId}`, {
          trackId,
          filePath,
        });
        return;
      }

      if (!hasEmbedding) {
        await this.audioAnalysisRepository.updateEmbedding(trackId, embedding);
      }
      if (!hasClassifiers) {
        await this.audioAnalysisRepository.updateDiscogsClassifiers(
          trackId,
          discogsClassifiers,
          discogsTempo,
        );
      }
    } catch (error) {
      this.logger.error(`Embedding backfill failed for track ${trackId}`, { trackId, error });
    }
  }
}
