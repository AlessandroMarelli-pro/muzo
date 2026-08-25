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

  async execute(contextUser: ActionContext['user']): Promise<{ trackCount: number }> {
    const tracks = await this.musicTrackRepository.getTracksMissingEmbedding();

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
