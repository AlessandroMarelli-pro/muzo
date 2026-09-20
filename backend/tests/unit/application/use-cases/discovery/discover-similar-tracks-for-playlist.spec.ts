import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import type { ICosineProvider } from 'src/application/ports/infrastructure/ICosineProvider';
import type { IYouTubeSyncProvider } from 'src/application/ports/infrastructure/IYouTubeSyncProvider';
import type { IMusicTrackRepository } from 'src/application/ports/repositories/IMusicTrackRepository';
import type {
  CosineTrackMatch as DomainCosineTrackMatch,
  ICosineTrackMatchRepository,
  UpsertCosineTrackMatchData,
} from 'src/application/ports/repositories/ICosineTrackMatchRepository';
import { DiscoverSimilarTracksForPlaylistUseCase } from 'src/application/use-cases/discovery/DiscoverSimilarTracksForPlaylist';
import type { GetPlaylistUseCase } from 'src/application/use-cases/playlist/GetPlaylist';
import { models } from 'src/kernel/types/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PLAYLIST_ID = models.playlist.id('playlist-1');

const noopLogger: ILogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;

function makePlaylistTrack(musicTrackId: string, artist: string, title: string) {
  return {
    track: {
      id: models.musicTrack.id(musicTrackId),
      artist,
      title,
      imagePath: undefined,
      technicalInfo: { duration: 200 },
    },
  } as unknown as { track: { id: string; artist: string; title: string; imagePath?: string; technicalInfo: { duration: number } } };
}

function makeGetPlaylistUseCase(tracks: ReturnType<typeof makePlaylistTrack>[]) {
  return {
    execute: vi.fn(async () => ({ tracks })),
  } as unknown as GetPlaylistUseCase;
}

function makeMusicTrackRepository(): IMusicTrackRepository {
  return {
    getAll: vi.fn(async () => []),
  } as unknown as IMusicTrackRepository;
}

function makeCosineTrackMatchRepository(): ICosineTrackMatchRepository {
  const store = new Map<string, DomainCosineTrackMatch>();
  return {
    findByMusicTrackId: vi.fn(async (id: string) => store.get(id) ?? null),
    upsert: vi.fn(async (data: UpsertCosineTrackMatchData) => {
      const row = { ...data } as unknown as DomainCosineTrackMatch;
      store.set(data.musicTrackId, row);
      return row;
    }),
    deleteByMusicTrackId: vi.fn(async (id: string) => store.delete(id)),
  };
}

function makeYouTubeProvider(): IYouTubeSyncProvider {
  return {
    findBestMatch: vi.fn(async () => ({ videoId: null, confidence: 'none' as const })),
  } as unknown as IYouTubeSyncProvider;
}

describe('DiscoverSimilarTracksForPlaylistUseCase', () => {
  let musicTrackRepository: IMusicTrackRepository;
  let cosineTrackMatchRepository: ICosineTrackMatchRepository;
  let youtubeSyncProvider: IYouTubeSyncProvider;

  beforeEach(() => {
    musicTrackRepository = makeMusicTrackRepository();
    cosineTrackMatchRepository = makeCosineTrackMatchRepository();
    youtubeSyncProvider = makeYouTubeProvider();
  });

  it('uses bulkSearch for all seeds and never falls back when everything matches', async () => {
    const tracks = [makePlaylistTrack('t1', 'Joy Orbison', 'Hyph Mngo')];
    const cosineProvider: ICosineProvider = {
      searchTrack: vi.fn(async () => null),
      lookupTrackByUrl: vi.fn(async () => null),
      getSimilarTracks: vi.fn(async () => []),
      bulkSearch: vi.fn(async () => ({
        matched: [
          {
            query: 'Joy Orbison - Hyph Mngo',
            track: { id: '185450', artist: 'Joy Orbison', title: 'Hyph Mngo' },
            similarTracks: [
              {
                id: '264028',
                artist: 'Julio Bashmore',
                title: 'Battle For Middle You',
                score: 0.87,
              },
            ],
          },
        ],
        unmatched: [],
      })),
    };

    const useCase = new DiscoverSimilarTracksForPlaylistUseCase(
      makeGetPlaylistUseCase(tracks),
      cosineProvider,
      musicTrackRepository,
      youtubeSyncProvider,
      cosineTrackMatchRepository,
      { createLogger: () => noopLogger },
      noopLogger,
    );

    const result = await useCase.execute(PLAYLIST_ID, 'user-1');

    expect(cosineProvider.bulkSearch).toHaveBeenCalledWith(
      ['Joy Orbison - Hyph Mngo'],
      expect.objectContaining({ similarLimit: 10 }),
    );
    expect(cosineProvider.getSimilarTracks).not.toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({ artist: 'Julio Bashmore', title: 'Battle For Middle You' }),
    ]);
  });

  it('falls back to per-track resolution for seeds bulkSearch reports as unmatched', async () => {
    const tracks = [makePlaylistTrack('t1', 'Unknown Artist', 'Unknown Track')];
    const cosineProvider: ICosineProvider = {
      searchTrack: vi.fn(async () => ({ id: 'cos-1', artist: 'Unknown Artist', title: 'Unknown Track' })),
      lookupTrackByUrl: vi.fn(async () => null),
      getSimilarTracks: vi.fn(async () => [
        { id: 'cos-2', artist: 'Fallback Artist', title: 'Fallback Track', score: 0.5 },
      ]),
      bulkSearch: vi.fn(async () => ({
        matched: [],
        unmatched: ['Unknown Artist - Unknown Track'],
      })),
    };

    const useCase = new DiscoverSimilarTracksForPlaylistUseCase(
      makeGetPlaylistUseCase(tracks),
      cosineProvider,
      musicTrackRepository,
      youtubeSyncProvider,
      cosineTrackMatchRepository,
      { createLogger: () => noopLogger },
      noopLogger,
    );

    const result = await useCase.execute(PLAYLIST_ID, 'user-1');

    expect(cosineProvider.searchTrack).toHaveBeenCalledWith('Unknown Artist', 'Unknown Track');
    expect(cosineProvider.getSimilarTracks).toHaveBeenCalledWith('cos-1', 10, undefined);
    expect(result).toEqual([
      expect.objectContaining({ artist: 'Fallback Artist', title: 'Fallback Track' }),
    ]);
  });

  it('forwards filters to both bulkSearch and the per-track fallback', async () => {
    const tracks = [makePlaylistTrack('t1', 'Artist A', 'Track A')];
    const filters = { startYear: 2000, maxPrice: 50 };
    const cosineProvider: ICosineProvider = {
      searchTrack: vi.fn(async () => ({ id: 'cos-1', artist: 'Artist A', title: 'Track A' })),
      lookupTrackByUrl: vi.fn(async () => null),
      getSimilarTracks: vi.fn(async () => []),
      bulkSearch: vi.fn(async () => ({ matched: [], unmatched: ['Artist A - Track A'] })),
    };

    const useCase = new DiscoverSimilarTracksForPlaylistUseCase(
      makeGetPlaylistUseCase(tracks),
      cosineProvider,
      musicTrackRepository,
      youtubeSyncProvider,
      cosineTrackMatchRepository,
      { createLogger: () => noopLogger },
      noopLogger,
    );

    await useCase.execute(PLAYLIST_ID, 'user-1', filters);

    expect(cosineProvider.bulkSearch).toHaveBeenCalledWith(
      ['Artist A - Track A'],
      expect.objectContaining(filters),
    );
    expect(cosineProvider.getSimilarTracks).toHaveBeenCalledWith('cos-1', 10, filters);
  });
});
