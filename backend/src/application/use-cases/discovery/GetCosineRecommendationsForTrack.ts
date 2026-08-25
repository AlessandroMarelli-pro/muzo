import { Inject } from '@nestjs/common';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { MusicTrackId } from 'src/kernel/ids';
import type { CosineSimilarTrack, ICosineProvider } from '../../ports/infrastructure/ICosineProvider';
import type { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

const RECOMMENDATIONS_LIMIT = 20;

export class GetCosineRecommendationsForTrackUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly cosineProvider: ICosineProvider,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('GetCosineRecommendationsForTrackUseCase');
  }

  async execute(trackId: MusicTrackId): Promise<CosineSimilarTrack[]> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    if (!track.artist || !track.title) {
      this.logger.info('Track missing artist/title, skipping Cosine lookup', { trackId });
      return [];
    }

    this.logger.debug('Searching Cosine for track', {
      trackId,
      artist: track.artist,
      title: track.title,
    });

    const cosineTrack = await this.cosineProvider.searchTrack(track.artist, track.title);
    if (!cosineTrack) {
      this.logger.info('No strict match found on Cosine for track', {
        trackId,
        artist: track.artist,
        title: track.title,
      });
      return [];
    }

    this.logger.debug('Track matched on Cosine', {
      trackId,
      artist: track.artist,
      title: track.title,
      cosineTrackId: cosineTrack.id,
    });

    const similarTracks = await this.cosineProvider.getSimilarTracks(
      cosineTrack.id,
      RECOMMENDATIONS_LIMIT,
    );

    this.logger.info('Fetched Cosine recommendations for track', {
      trackId,
      cosineTrackId: cosineTrack.id,
      recommendationCount: similarTracks.length,
    });

    return similarTracks;
  }
}
