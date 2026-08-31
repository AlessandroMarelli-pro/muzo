import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { MusicTrackId } from 'src/kernel/ids';
import type {
  CosineTrackMatchMethod,
  ICosineTrackMatchRepository,
} from '../../ports/repositories/ICosineTrackMatchRepository';
import type { ICosineProvider } from '../../ports/infrastructure/ICosineProvider';
import type { IYouTubeSyncProvider } from '../../ports/infrastructure/IYouTubeSyncProvider';

export type ResolveCosineTrackIdDeps = {
  cosineProvider: ICosineProvider;
  youtubeSyncProvider: IYouTubeSyncProvider;
  cosineTrackMatchRepository: ICosineTrackMatchRepository;
  logger: ILogger;
};

export type ResolveCosineTrackIdParams = {
  musicTrackId: MusicTrackId;
  artist: string;
  title: string;
  durationSeconds: number;
  userId: string;
};

export type ResolvedCosineTrack = {
  id: string;
  method: CosineTrackMatchMethod;
  /** true when the id came from the mapping table rather than a fresh lookup. */
  fromCache: boolean;
};

/**
 * Resolves a local track to its cosine.club track id, reading from and writing to
 * the CosineTrackMatch mapping table. Cache-forever-until-miss: once stored, the id
 * is reused until {@link forgetCosineTrackMatch} drops it (see stale-id handling in
 * the callers).
 */
export async function resolveCosineTrackId(
  deps: ResolveCosineTrackIdDeps,
  params: ResolveCosineTrackIdParams,
): Promise<ResolvedCosineTrack | null> {
  const { cosineProvider, youtubeSyncProvider, cosineTrackMatchRepository, logger } = deps;
  const { musicTrackId, artist, title, durationSeconds, userId } = params;

  const cached = await cosineTrackMatchRepository.findByMusicTrackId(musicTrackId);
  if (cached) {
    logger.debug('Using cached Cosine track id', {
      musicTrackId,
      cosineTrackId: cached.cosineTrackId,
      matchMethod: cached.matchMethod,
    });
    return { id: cached.cosineTrackId, method: cached.matchMethod, fromCache: true };
  }

  let cosineTrack = await cosineProvider.searchTrack(artist, title);
  let method: CosineTrackMatchMethod = 'search';

  if (!cosineTrack) {
    logger.info('No strict Cosine match, trying YouTube fallback', { musicTrackId, artist, title });
    try {
      const match = await youtubeSyncProvider.findBestMatch(artist, title, durationSeconds, userId);
      if (match.videoId) {
        cosineTrack = await cosineProvider.lookupTrackByUrl(
          `https://www.youtube.com/watch?v=${match.videoId}`,
        );
        method = 'youtube-lookup';
      }
    } catch (error) {
      logger.warn('YouTube fallback lookup failed', {
        musicTrackId,
        artist,
        title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!cosineTrack) {
    logger.info('No Cosine match found for track', { musicTrackId, artist, title });
    return null;
  }

  await cosineTrackMatchRepository.upsert({
    musicTrackId,
    cosineTrackId: cosineTrack.id,
    matchMethod: method,
  });

  logger.info('Resolved and stored Cosine track id', {
    musicTrackId,
    cosineTrackId: cosineTrack.id,
    matchMethod: method,
  });

  return { id: cosineTrack.id, method, fromCache: false };
}

/** Drops a stale mapping (id yielded no similar tracks) so the next call re-resolves. */
export async function forgetCosineTrackMatch(
  deps: Pick<ResolveCosineTrackIdDeps, 'cosineTrackMatchRepository' | 'logger'>,
  musicTrackId: MusicTrackId,
): Promise<void> {
  const deleted = await deps.cosineTrackMatchRepository.deleteByMusicTrackId(musicTrackId);
  if (deleted) {
    deps.logger.info('Dropped stale Cosine track mapping', { musicTrackId });
  }
}
