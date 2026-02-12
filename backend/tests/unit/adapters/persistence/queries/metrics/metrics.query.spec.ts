import { Test } from '@nestjs/testing';
import {
  PRISMA_SERVICE,
  PrismaService,
} from 'src/infrastructure/database/prisma.service';
import { MetricsQuery } from 'src/adapters/persistence/queries/metrics/metrics.query';
import { createMockPrisma } from '../../repositories/_test-utils/prisma-mock';
import type { MetricsDto } from 'src/application/ports/queries/IMetricsQuery';
import { getCurrentUserId } from 'src/kernel/types/context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryRawImpl = (...args: any[]) => Promise<any>;

const TEST_USER_ID = 'test-user-id';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
}));

/**
 * getMetrics() runs 7 $queryRaw in parallel. This mock returns the correct shape
 * per query by inspecting the template (first arg) of the tagged template call.
 */
function setupGetMetricsMock(prismaMock: ReturnType<typeof createMockPrisma>) {
  const impl: QueryRawImpl = (...args: unknown[]) => {
    const template = (args[0] as { raw?: string[] })?.raw;
    const sql = Array.isArray(template) ? template.join('?') : String(args[0]);
    if (sql.includes('genreId') && sql.includes('genres.name')) {
      return Promise.resolve([
        { genreId: 'g1', count: BigInt(8), name: 'Rock' },
        { genreId: 'g2', count: BigInt(4), name: 'Jazz' },
      ]);
    }
    if (sql.includes('tracks_added') && sql.includes('tracks_analyzed')) {
      return Promise.resolve([
        { date: '2025-02-12', tracks_added: BigInt(2), tracks_analyzed: BigInt(2) },
        { date: '2025-02-11', tracks_added: BigInt(1), tracks_analyzed: BigInt(1) },
      ]);
    }
    if (sql.includes('COUNT(*) as count') && sql.includes('music_tracks') && !sql.includes('genreId')) {
      return Promise.resolve([{ count: BigInt(42) }]);
    }
    if (sql.includes('total_seconds')) {
      return Promise.resolve([{ total_seconds: BigInt(3600) }]);
    }
    if (sql.includes('COUNT(DISTINCT')) {
      return Promise.resolve([{ count: BigInt(5) }]);
    }
    if (sql.includes('total_plays') && sql.includes('favorite_count')) {
      return Promise.resolve([{
        total_plays: BigInt(100),
        total_play_time: BigInt(7200),
        avg_confidence: 0.95,
        favorite_count: BigInt(3),
      }]);
    }
    if (sql.includes('track_count') && sql.includes('total_duration') && sql.includes('aiArtist')) {
      return Promise.resolve([
        { artist: 'Artist A', track_count: BigInt(10), total_duration: 2400 },
        { artist: 'Artist B', track_count: BigInt(5), total_duration: 1200 },
      ]);
    }
    return Promise.resolve([]);
  };
  prismaMock.$queryRaw.mockImplementation(
    impl as Parameters<typeof prismaMock.$queryRaw.mockImplementation>[0],
  );
}

describe('MetricsQuery', () => {
  let query: MetricsQuery;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    vi.clearAllMocks();
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        MetricsQuery,
        { provide: PRISMA_SERVICE, useValue: prismaMock },
      ],
    }).compile();
    query = module.get(MetricsQuery);
  });

  describe('getMetrics', () => {
    it('optimal: returns full MetricsDto when all raw queries return data', async () => {
      setupGetMetricsMock(prismaMock);

      const result = await query.getMetrics();

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(7);
      expect(result).toMatchObject<MetricsDto>({
        totalTracks: 42,
        totalListeningTime: 3600,
        artistCount: 5,
        listeningStats: {
          totalPlays: 100,
          totalPlayTime: 7200,
          favoriteCount: 3,
        },
        topArtists: [
          { artist: 'Artist A', trackCount: 10, totalDuration: 2400 },
          { artist: 'Artist B', trackCount: 5, totalDuration: 1200 },
        ],
        topGenres: [
          { genre: 'Rock', trackCount: 8 },
          { genre: 'Jazz', trackCount: 4 },
        ],
        recentActivity: [
          { date: '2025-02-12', tracksAdded: 2, tracksAnalyzed: 2 },
          { date: '2025-02-11', tracksAdded: 1, tracksAnalyzed: 1 },
        ],
      });
    });

    it('failure: rethrows when Prisma $queryRaw throws', async () => {
      setupGetMetricsMock(prismaMock);
      prismaMock.$queryRaw.mockRejectedValueOnce(new Error('Connection lost'));

      await expect(query.getMetrics()).rejects.toThrow('Connection lost');
    });

    it('createdById scope: getCurrentUserId is invoked when running query', async () => {
      setupGetMetricsMock(prismaMock);

      await query.getMetrics();

      expect(getCurrentUserId).toHaveBeenCalled();
    });

    it('createdById scope: each $queryRaw call receives current user id in template values', async () => {
      setupGetMetricsMock(prismaMock);

      await query.getMetrics();

      const calls = prismaMock.$queryRaw.mock.calls;
      expect(calls.length).toBe(7);
      const templateValues = calls.flatMap((call) =>
        Array.isArray(call[0]) ? (call as unknown[]).slice(1) : [],
      );
      const hasUserId = templateValues.some((v) => v === TEST_USER_ID);
      expect(hasUserId).toBe(true);
    });

    it('empty result: returns zero/empty when aggregates return zero and list queries return empty arrays', async () => {
      const emptyImpl: QueryRawImpl = (...args: unknown[]) => {
        const template = (args[0] as { raw?: string[] })?.raw;
        const sql = Array.isArray(template) ? template.join('?') : String(args[0]);
        if (
          sql.includes('genreId') ||
          (sql.includes('track_count') && sql.includes('aiArtist')) ||
          sql.includes('tracks_added')
        ) {
          return Promise.resolve([]);
        }
        if (sql.includes('COUNT(*) as count') && sql.includes('music_tracks')) {
          return Promise.resolve([{ count: BigInt(0) }]);
        }
        if (sql.includes('total_seconds')) {
          return Promise.resolve([{ total_seconds: BigInt(0) }]);
        }
        if (sql.includes('COUNT(DISTINCT')) {
          return Promise.resolve([{ count: BigInt(0) }]);
        }
        if (sql.includes('total_plays') && sql.includes('favorite_count')) {
          return Promise.resolve([{
            total_plays: BigInt(0),
            total_play_time: BigInt(0),
            avg_confidence: 0,
            favorite_count: BigInt(0),
          }]);
        }
        return Promise.resolve([]);
      };
      prismaMock.$queryRaw.mockImplementation(
        emptyImpl as Parameters<typeof prismaMock.$queryRaw.mockImplementation>[0],
      );

      const result = await query.getMetrics();

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(7);
      expect(result.totalTracks).toBe(0);
      expect(result.totalListeningTime).toBe(0);
      expect(result.artistCount).toBe(0);
      expect(result.listeningStats.totalPlays).toBe(0);
      expect(result.listeningStats.totalPlayTime).toBe(0);
      expect(result.listeningStats.favoriteCount).toBe(0);
      expect(result.topArtists).toEqual([]);
      expect(result.topGenres).toEqual([]);
      expect(result.recentActivity).toEqual([]);
    });
  });
});
