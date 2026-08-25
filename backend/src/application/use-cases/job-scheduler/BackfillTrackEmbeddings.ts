import { MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';
import { IEmbeddingBackfillProducer } from '../../ports/infrastructure/IEmbeddingBackfillProducer';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class BackfillTrackEmbeddingsUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly embeddingBackfillProducer: IEmbeddingBackfillProducer,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('BackfillTrackEmbeddingsUseCase');
  }

  /**
   * When `trackId` is provided, backfills that single track regardless of whether it already
   * has an embedding -- useful for testing the pipeline against one known track. Otherwise
   * backfills every track missing an embedding, optionally capped to the first `limit` of them.
   */
  async execute(
    contextUser: ActionContext['user'],
    trackId?: MusicTrackId,
    limit?: number,
  ): Promise<{ trackCount: number }> {
    const allTracks = trackId
      ? [await this.musicTrackRepository.getOneById(trackId)]
      : await this.musicTrackRepository.getTracksMissingEmbedding();
    const tracks = limit != null ? allTracks.slice(0, limit) : allTracks;

    if (tracks.length === 0) {
      this.logger.info('No tracks missing an embedding; nothing to backfill');
      return { trackCount: 0 };
    }

    this.logger.info(`Scheduling embedding backfill for ${tracks.length} tracks`);

    await this.embeddingBackfillProducer.scheduleEmbeddingBackfill(
      tracks.map((track) => ({ trackId: track.id, filePath: track.fileInfo.filePath })),
      contextUser,
    );

    return { trackCount: tracks.length };
  }
}
