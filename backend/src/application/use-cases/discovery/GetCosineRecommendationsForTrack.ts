import { Inject } from '@nestjs/common';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { MusicTrackId } from 'src/kernel/ids';
import type { CosineSimilarTrack, ICosineProvider } from '../../ports/infrastructure/ICosineProvider';
import type { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import type { IYouTubeSyncProvider } from '../../ports/infrastructure/IYouTubeSyncProvider';
import type { ICosineTrackMatchRepository } from '../../ports/repositories/ICosineTrackMatchRepository';
import { forgetCosineTrackMatch, resolveCosineTrackId } from './resolve-cosine-track-id';

const RECOMMENDATIONS_LIMIT = 20;

export class GetCosineRecommendationsForTrackUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly cosineProvider: ICosineProvider,
    private readonly youtubeSyncProvider: IYouTubeSyncProvider,
    private readonly cosineTrackMatchRepository: ICosineTrackMatchRepository,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('GetCosineRecommendationsForTrackUseCase');
  }

  async execute(trackId: MusicTrackId, userId: string): Promise<CosineSimilarTrack[]> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    if (!track.artist || !track.title) {
      this.logger.info('Track missing artist/title, skipping Cosine lookup', { trackId });
      return [];
    }

    const deps = {
      cosineProvider: this.cosineProvider,
      youtubeSyncProvider: this.youtubeSyncProvider,
      cosineTrackMatchRepository: this.cosineTrackMatchRepository,
      logger: this.logger,
    };
    const resolveParams = {
      musicTrackId: trackId,
      artist: track.artist,
      title: track.title,
      durationSeconds: track.technicalInfo?.duration ?? 0,
      userId,
    };

    const resolved = await resolveCosineTrackId(deps, resolveParams);
    if (!resolved) {
      return [];
    }

    let similarTracks = await this.cosineProvider.getSimilarTracks(
      resolved.id,
      RECOMMENDATIONS_LIMIT,
    );

    // A cached id that no longer yields results is stale — drop it and re-resolve once.
    if (similarTracks.length === 0 && resolved.fromCache) {
      await forgetCosineTrackMatch(deps, trackId);
      const reResolved = await resolveCosineTrackId(deps, resolveParams);
      if (!reResolved) {
        return [];
      }
      similarTracks = await this.cosineProvider.getSimilarTracks(
        reResolved.id,
        RECOMMENDATIONS_LIMIT,
      );
    }

    this.logger.info('Fetched Cosine recommendations for track', {
      trackId,
      cosineTrackId: resolved.id,
      recommendationCount: similarTracks.length,
    });

    return similarTracks;
  }
}
