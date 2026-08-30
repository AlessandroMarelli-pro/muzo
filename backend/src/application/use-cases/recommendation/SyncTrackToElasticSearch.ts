import { Inject } from '@nestjs/common';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { MusicTrackId } from 'src/kernel/ids';
import { ITrackIndexerPort } from '../../ports/queries/ITrackIndexerPort';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class SyncTrackToElasticSearchUseCase {
  constructor(
    private readonly trackIndexerPort: ITrackIndexerPort,
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('SyncTrackToElasticSearchUseCase');
  }

  async execute(trackId: MusicTrackId): Promise<void> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    this.logger.info('Syncing track to elasticsearch', {
      trackId,
      track: {
        ...track,
        features: { ...track.features, embedding: track.features?.embedding?.length },
      },
    });
    return this.trackIndexerPort.indexTrack(track);
  }
}
