import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import type { ICosineProvider } from 'src/application/ports/infrastructure/ICosineProvider';
import type { IYouTubeSyncProvider } from 'src/application/ports/infrastructure/IYouTubeSyncProvider';
import type {
  CosineTrackMatch as DomainCosineTrackMatch,
  ICosineTrackMatchRepository,
  UpsertCosineTrackMatchData,
} from 'src/application/ports/repositories/ICosineTrackMatchRepository';
import {
  forgetCosineTrackMatch,
  resolveCosineTrackId,
} from 'src/application/use-cases/discovery/resolve-cosine-track-id';
import { models } from 'src/kernel/types/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MUSIC_TRACK_ID = models.musicTrack.id('track-1');

const noopLogger: ILogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;

class InMemoryCosineTrackMatchRepository implements ICosineTrackMatchRepository {
  private store = new Map<string, DomainCosineTrackMatch>();

  async findByMusicTrackId(musicTrackId: string) {
    return this.store.get(musicTrackId) ?? null;
  }

  async upsert(data: UpsertCosineTrackMatchData) {
    const row = {
      id: models.cosineTrackMatch.id(`ctm-${data.musicTrackId}`),
      createdAt: new Date(),
      createdById: models.user.id('u'),
      updatedAt: undefined,
      updatedById: undefined,
      musicTrackId: data.musicTrackId,
      cosineTrackId: data.cosineTrackId,
      matchMethod: data.matchMethod,
    } as DomainCosineTrackMatch;
    this.store.set(data.musicTrackId, row);
    return row;
  }

  async deleteByMusicTrackId(musicTrackId: string) {
    return this.store.delete(musicTrackId);
  }
}

function makeCosineProvider(overrides: Partial<ICosineProvider> = {}): ICosineProvider {
  return {
    searchTrack: vi.fn(async () => null),
    lookupTrackByUrl: vi.fn(async () => null),
    getSimilarTracks: vi.fn(async () => []),
    ...overrides,
  };
}

function makeYouTubeProvider(overrides: Partial<IYouTubeSyncProvider> = {}): IYouTubeSyncProvider {
  return {
    findBestMatch: vi.fn(async () => ({ videoId: null, confidence: 'none' as const })),
    ...overrides,
  } as unknown as IYouTubeSyncProvider;
}

const params = {
  musicTrackId: MUSIC_TRACK_ID,
  artist: 'Aphex Twin',
  title: 'Xtal',
  durationSeconds: 300,
  userId: 'user-1',
};

describe('resolveCosineTrackId', () => {
  let repo: InMemoryCosineTrackMatchRepository;

  beforeEach(() => {
    repo = new InMemoryCosineTrackMatchRepository();
  });

  it('returns and stores the id from a direct search match', async () => {
    const cosineProvider = makeCosineProvider({
      searchTrack: vi.fn(async () => ({ id: 'cos-1', artist: 'Aphex Twin', title: 'Xtal' })),
    });
    const deps = {
      cosineProvider,
      youtubeSyncProvider: makeYouTubeProvider(),
      cosineTrackMatchRepository: repo,
      logger: noopLogger,
    };

    const result = await resolveCosineTrackId(deps, params);

    expect(result).toEqual({ id: 'cos-1', method: 'search', fromCache: false });
    expect(await repo.findByMusicTrackId(MUSIC_TRACK_ID)).toMatchObject({
      cosineTrackId: 'cos-1',
      matchMethod: 'search',
    });
  });

  it('reuses a cached id without hitting the provider', async () => {
    await repo.upsert({ musicTrackId: MUSIC_TRACK_ID, cosineTrackId: 'cos-cached', matchMethod: 'search' });
    const cosineProvider = makeCosineProvider();
    const deps = {
      cosineProvider,
      youtubeSyncProvider: makeYouTubeProvider(),
      cosineTrackMatchRepository: repo,
      logger: noopLogger,
    };

    const result = await resolveCosineTrackId(deps, params);

    expect(result).toEqual({ id: 'cos-cached', method: 'search', fromCache: true });
    expect(cosineProvider.searchTrack).not.toHaveBeenCalled();
  });

  it('falls back to YouTube lookup and records the method', async () => {
    const cosineProvider = makeCosineProvider({
      lookupTrackByUrl: vi.fn(async () => ({ id: 'cos-yt', artist: 'Aphex Twin', title: 'Xtal' })),
    });
    const youtubeSyncProvider = makeYouTubeProvider({
      findBestMatch: vi.fn(async () => ({ videoId: 'yt-123', confidence: 'exact' as const })),
    });
    const deps = {
      cosineProvider,
      youtubeSyncProvider,
      cosineTrackMatchRepository: repo,
      logger: noopLogger,
    };

    const result = await resolveCosineTrackId(deps, params);

    expect(result).toEqual({ id: 'cos-yt', method: 'youtube-lookup', fromCache: false });
    expect(cosineProvider.lookupTrackByUrl).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=yt-123',
    );
  });

  it('returns null and stores nothing when no match is found', async () => {
    const deps = {
      cosineProvider: makeCosineProvider(),
      youtubeSyncProvider: makeYouTubeProvider(),
      cosineTrackMatchRepository: repo,
      logger: noopLogger,
    };

    expect(await resolveCosineTrackId(deps, params)).toBeNull();
    expect(await repo.findByMusicTrackId(MUSIC_TRACK_ID)).toBeNull();
  });

  it('forgetCosineTrackMatch drops a stored mapping', async () => {
    await repo.upsert({ musicTrackId: MUSIC_TRACK_ID, cosineTrackId: 'cos-x', matchMethod: 'search' });
    await forgetCosineTrackMatch({ cosineTrackMatchRepository: repo, logger: noopLogger }, MUSIC_TRACK_ID);
    expect(await repo.findByMusicTrackId(MUSIC_TRACK_ID)).toBeNull();
  });
});
