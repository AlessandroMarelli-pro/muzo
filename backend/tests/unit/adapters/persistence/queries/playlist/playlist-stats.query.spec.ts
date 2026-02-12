import { Test } from '@nestjs/testing';
import {
  PRISMA_SERVICE,
  PrismaService,
} from 'src/infrastructure/database/prisma.service';
import { PlaylistStatsQuery } from 'src/adapters/persistence/queries/playlist/playlist-stats.query';
import { createMockPrisma } from '../../repositories/_test-utils/prisma-mock';
import { models } from 'src/kernel/types/models';
import type { RawPlaylistStatsRow } from 'src/application/ports/queries/IPlaylistStatsQuery';
import { PlaylistId } from 'src/kernel/ids';

const TEST_USER_ID = 'test-user-id';
const PLAYLIST_DB_ID = 'playlist-1';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
}));

function makeRawPlaylistStatsRow(
  overrides: Partial<RawPlaylistStatsRow> = {},
): RawPlaylistStatsRow {
  return {
    id: PLAYLIST_DB_ID,
    name: 'My Playlist',
    description: 'Description',
    createdAt: new Date(),
    updatedAt: new Date(),
    numberOfTracks: 10,
    totalDuration: 3600,
    bpmMin: 90,
    bpmMax: 130,
    energyMin: 0.2,
    energyMax: 0.9,
    genresCount: 3,
    subgenresCount: 5,
    allGenres: 'rock,indie,electronic',
    allSubgenres: 'indie rock,post-punk,synth',
    allImages: 'img1.jpg,img2.jpg',
    ...overrides,
  };
}

describe('PlaylistStatsQuery', () => {
  let query: PlaylistStatsQuery;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        PlaylistStatsQuery,
        { provide: PRISMA_SERVICE, useValue: prismaMock },
      ],
    }).compile();
    query = module.get(PlaylistStatsQuery);
  });

  describe('getPlaylistStats', () => {
    it('optimal: returns playlist stats when raw query returns one row', async () => {
      const playlistId = models.playlist.id(PLAYLIST_DB_ID) as PlaylistId;
      const rawRow = makeRawPlaylistStatsRow();
      prismaMock.$queryRaw.mockResolvedValue([rawRow]);

      const result = await query.getPlaylistStats(playlistId);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(result.playlistId).toEqual(models.playlist.id(PLAYLIST_DB_ID));
      expect(result.numberOfTracks).toBe(10);
      expect(result.totalDuration).toBe(3600);
      expect(result.bpmRange).toEqual({ min: 90, max: 130 });
      expect(result.energyRange).toEqual({ min: 0.2, max: 0.9 });
      expect(result.genresCount).toBe(3);
      expect(result.subgenresCount).toBe(5);
      expect(result.topGenres).toEqual(['rock', 'indie', 'electronic']);
      expect(result.topSubgenres).toEqual(['indie rock', 'post-punk', 'synth']);
      expect(result.images).toEqual(['img1.jpg', 'img2.jpg']);
    });

    it('failure: throws NotFoundError when Prisma rejects with P2025', async () => {
      const playlistId = models.playlist.id(PLAYLIST_DB_ID) as PlaylistId;
      prismaMock.$queryRaw.mockRejectedValue({ code: 'P2025' });

      await expect(query.getPlaylistStats(playlistId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: expect.stringContaining(playlistId),
      });
    });

    it('failure: rethrows when Prisma rejects with non-P2025 error', async () => {
      const playlistId = models.playlist.id(PLAYLIST_DB_ID) as PlaylistId;
      prismaMock.$queryRaw.mockRejectedValue(new Error('Connection lost'));

      await expect(query.getPlaylistStats(playlistId)).rejects.toThrow(
        'Connection lost',
      );
    });

    it('createdById scope: raw query is invoked with current user id in template values', async () => {
      const playlistId = models.playlist.id(PLAYLIST_DB_ID) as PlaylistId;
      const rawRow = makeRawPlaylistStatsRow();
      prismaMock.$queryRaw.mockResolvedValue([rawRow]);

      await query.getPlaylistStats(playlistId);

      const callArgs = prismaMock.$queryRaw.mock.calls[0];
      const templateValues = Array.isArray(callArgs[0]) ? callArgs.slice(1) : [];
      const hasUserId = templateValues.some(
        (v) => v === TEST_USER_ID || (typeof v === 'string' && v === TEST_USER_ID),
      );
      expect(hasUserId).toBe(true);
    });

    it('empty result: rejects when raw query returns no rows (mapper receives undefined)', async () => {
      const playlistId = models.playlist.id(PLAYLIST_DB_ID) as PlaylistId;
      prismaMock.$queryRaw.mockResolvedValue([]);

      await expect(query.getPlaylistStats(playlistId)).rejects.toThrow();
    });
  });

  describe('getPlaylistsStats', () => {
    it('optimal: returns array of playlist stats for current user', async () => {
      const row1 = makeRawPlaylistStatsRow({
        id: 'p1',
        name: 'Playlist 1',
        numberOfTracks: 5,
        totalDuration: 1200,
      });
      const row2 = makeRawPlaylistStatsRow({
        id: 'p2',
        name: 'Playlist 2',
        numberOfTracks: 3,
        totalDuration: 600,
      });
      prismaMock.$queryRaw.mockResolvedValue([row1, row2]);

      const result = await query.getPlaylistsStats();

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].playlistId).toEqual(models.playlist.id('p1'));
      expect(result[0].numberOfTracks).toBe(5);
      expect(result[0].totalDuration).toBe(1200);
      expect(result[1].playlistId).toEqual(models.playlist.id('p2'));
      expect(result[1].numberOfTracks).toBe(3);
      expect(result[1].totalDuration).toBe(600);
    });

    it('failure: rethrows when Prisma rejects', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('DB error'));

      await expect(query.getPlaylistsStats()).rejects.toThrow('DB error');
    });

    it('createdById scope: raw query is invoked with current user id in template values', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      await query.getPlaylistsStats();

      const callArgs = prismaMock.$queryRaw.mock.calls[0];
      const templateValues = Array.isArray(callArgs[0]) ? callArgs.slice(1) : [];
      const hasUserId = templateValues.some(
        (v) => v === TEST_USER_ID || (typeof v === 'string' && v === TEST_USER_ID),
      );
      expect(hasUserId).toBe(true);
    });

    it('empty result: returns empty array when no playlists', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      const result = await query.getPlaylistsStats();

      expect(result).toEqual([]);
    });
  });
});
