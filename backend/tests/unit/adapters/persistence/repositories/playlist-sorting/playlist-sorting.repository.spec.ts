import { Test } from '@nestjs/testing';
import {
  PlaylistSorting as PrismaPlaylistSorting,
  PlaylistSortingDirection as PrismaPlaylistSortingDirection,
  PlaylistSortingKey as PrismaPlaylistSortingKey,
} from '@prisma/client';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { PlaylistSortingRepository } from 'src/adapters/persistence/repositories/playlist-sorting/playlist-sorting.repository';
import { createMockPrisma } from '../_test-utils/prisma-mock';
import { models } from 'src/kernel/types/models';
import type { PlaylistSorting } from 'src/kernel/types/model-types';
import { PlaylistId } from 'src/kernel/ids';
import type { PlaylistSortingUpsertData } from 'src/application/ports/repositories/IPlaylistSortingRepository';

const TEST_USER_ID = 'test-user-id';
const PLAYLIST_ID_DB = 'playlist-1';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => 'test-user-id'),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: 'User:test-user-id' })),
}));

function makePrismaPlaylistSortingRow(
  overrides: Partial<PrismaPlaylistSorting> = {},
): PrismaPlaylistSorting {
  return {
    id: 'sorting-1',
    playlistId: PLAYLIST_ID_DB,
    sortingKey: PrismaPlaylistSortingKey.position,
    sortingDirection: PrismaPlaylistSortingDirection.asc,
    createdAt: new Date(),
    createdById: TEST_USER_ID,
    updatedAt: null,
    updatedById: null,
    ...overrides,
  };
}

function makeDomainPlaylistSorting(overrides: Partial<PlaylistSorting> = {}): PlaylistSorting {
  return {
    id: models.playlistSorting.id('sorting-1'),
    createdAt: new Date(),
    createdById: models.user.id(TEST_USER_ID),
    updatedAt: undefined,
    updatedById: undefined,
    playlistId: models.playlist.id(PLAYLIST_ID_DB) as PlaylistId,
    sortingKey: 'position',
    sortingDirection: 'asc',
    ...overrides,
  };
}

describe('PlaylistSortingRepository', () => {
  let repo: PlaylistSortingRepository;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [PlaylistSortingRepository, { provide: PRISMA_SERVICE, useValue: prismaMock }],
    }).compile();
    repo = module.get(PlaylistSortingRepository);
  });

  describe('save', () => {
    it('optimal: creates playlist sorting and returns domain model', async () => {
      const domain = makeDomainPlaylistSorting();
      const row = makePrismaPlaylistSortingRow({
        id: 'sorting-1',
        playlistId: PLAYLIST_ID_DB,
        sortingKey: domain.sortingKey as PrismaPlaylistSortingKey,
        sortingDirection: domain.sortingDirection as PrismaPlaylistSortingDirection,
      });
      prismaMock.playlistSorting.create.mockResolvedValue(row);

      const result = await repo.save(domain);

      expect(prismaMock.playlistSorting.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          playlistId: PLAYLIST_ID_DB,
          sortingKey: domain.sortingKey,
          sortingDirection: domain.sortingDirection,
          createdById: TEST_USER_ID,
        }),
      });
      expect(result.id).toBeDefined();
      expect(result.playlistId).toBeDefined();
      expect(result.sortingKey).toBe(domain.sortingKey);
    });

    it('failure: rethrows when Prisma create throws', async () => {
      const domain = makeDomainPlaylistSorting();
      prismaMock.playlistSorting.create.mockRejectedValue(new Error('Unique constraint failed'));

      await expect(repo.save(domain)).rejects.toThrow('Unique constraint failed');
    });

    it('createdById scope: create is called with current user id in data', async () => {
      const domain = makeDomainPlaylistSorting();
      prismaMock.playlistSorting.create.mockResolvedValue(makePrismaPlaylistSortingRow());

      await repo.save(domain);

      expect(prismaMock.playlistSorting.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ createdById: TEST_USER_ID }),
      });
    });
  });

  describe('getByPlaylistId', () => {
    it('optimal: returns sorting when found', async () => {
      const playlistId = models.playlist.id(PLAYLIST_ID_DB) as PlaylistId;
      const row = makePrismaPlaylistSortingRow({ playlistId: PLAYLIST_ID_DB });
      prismaMock.playlistSorting.findFirst.mockResolvedValue(row);

      const result = await repo.getByPlaylistId(playlistId);

      expect(prismaMock.playlistSorting.findFirst).toHaveBeenCalledWith({
        where: { playlistId: PLAYLIST_ID_DB, createdById: TEST_USER_ID },
      });
      expect(result).not.toBeNull();
      expect(result!.sortingKey).toBe(row.sortingKey);
      expect(result!.sortingDirection).toBe(row.sortingDirection);
    });

    it('failure: rethrows when Prisma findFirst throws', async () => {
      const playlistId = models.playlist.id(PLAYLIST_ID_DB) as PlaylistId;
      prismaMock.playlistSorting.findFirst.mockRejectedValue(new Error('DB error'));

      await expect(repo.getByPlaylistId(playlistId)).rejects.toThrow('DB error');
    });

    it('createdById scope: findFirst is called with current user in where', async () => {
      const playlistId = models.playlist.id(PLAYLIST_ID_DB) as PlaylistId;
      prismaMock.playlistSorting.findFirst.mockResolvedValue(makePrismaPlaylistSortingRow());

      await repo.getByPlaylistId(playlistId);

      expect(prismaMock.playlistSorting.findFirst).toHaveBeenCalledWith({
        where: { playlistId: PLAYLIST_ID_DB, createdById: TEST_USER_ID },
      });
    });

    it('empty result: returns null when no sorting for playlist', async () => {
      const playlistId = models.playlist.id(PLAYLIST_ID_DB) as PlaylistId;
      prismaMock.playlistSorting.findFirst.mockResolvedValue(null);

      const result = await repo.getByPlaylistId(playlistId);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('optimal: updates sorting and returns domain model', async () => {
      const playlistId = models.playlist.id(PLAYLIST_ID_DB) as PlaylistId;
      const data: PlaylistSortingUpsertData = {
        sortingKey: 'addedAt',
        sortingDirection: 'desc',
      };
      const updatedRow = makePrismaPlaylistSortingRow({
        playlistId: PLAYLIST_ID_DB,
        sortingKey: PrismaPlaylistSortingKey.addedAt,
        sortingDirection: PrismaPlaylistSortingDirection.desc,
      });
      prismaMock.playlistSorting.update.mockResolvedValue(updatedRow);

      const result = await repo.update(playlistId, data);

      expect(prismaMock.playlistSorting.update).toHaveBeenCalledWith({
        where: { playlistId: PLAYLIST_ID_DB, createdById: TEST_USER_ID },
        data: {
          sortingKey: data.sortingKey,
          sortingDirection: data.sortingDirection,
        },
      });
      expect(result.sortingKey).toBe('addedAt');
      expect(result.sortingDirection).toBe('desc');
    });

    it('failure: throws NotFoundError when Prisma update throws P2025', async () => {
      const playlistId = models.playlist.id('playlist-missing') as PlaylistId;
      const data: PlaylistSortingUpsertData = {
        sortingKey: 'position',
        sortingDirection: 'asc',
      };
      prismaMock.playlistSorting.update.mockRejectedValue({ code: 'P2025' });

      await expect(repo.update(playlistId, data)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: expect.stringContaining('playlist-missing'),
      });
    });

    it('failure: rethrows when Prisma update throws non-P2025 error', async () => {
      const playlistId = models.playlist.id(PLAYLIST_ID_DB) as PlaylistId;
      const data: PlaylistSortingUpsertData = {
        sortingKey: 'position',
        sortingDirection: 'asc',
      };
      prismaMock.playlistSorting.update.mockRejectedValue(new Error('Connection lost'));

      await expect(repo.update(playlistId, data)).rejects.toThrow('Connection lost');
    });

    it('createdById scope: update is called with current user in where', async () => {
      const playlistId = models.playlist.id(PLAYLIST_ID_DB) as PlaylistId;
      const data: PlaylistSortingUpsertData = {
        sortingKey: 'position',
        sortingDirection: 'asc',
      };
      prismaMock.playlistSorting.update.mockResolvedValue(makePrismaPlaylistSortingRow());

      await repo.update(playlistId, data);

      expect(prismaMock.playlistSorting.update).toHaveBeenCalledWith({
        where: { playlistId: PLAYLIST_ID_DB, createdById: TEST_USER_ID },
        data: {
          sortingKey: data.sortingKey,
          sortingDirection: data.sortingDirection,
        },
      });
    });
  });

  describe('verifyExistence', () => {
    it('optimal: returns true when sorting exists', async () => {
      const playlistId = models.playlist.id(PLAYLIST_ID_DB) as PlaylistId;
      prismaMock.playlistSorting.findFirst.mockResolvedValue(makePrismaPlaylistSortingRow());

      const result = await repo.verifyExistence(playlistId);

      expect(prismaMock.playlistSorting.findFirst).toHaveBeenCalledWith({
        where: { playlistId: PLAYLIST_ID_DB, createdById: TEST_USER_ID },
      });
      expect(result).toBe(true);
    });

    it('optimal: returns false when no sorting for playlist', async () => {
      const playlistId = models.playlist.id(PLAYLIST_ID_DB) as PlaylistId;
      prismaMock.playlistSorting.findFirst.mockResolvedValue(null);

      const result = await repo.verifyExistence(playlistId);

      expect(result).toBe(false);
    });

    it('failure: rethrows when Prisma findFirst throws', async () => {
      const playlistId = models.playlist.id(PLAYLIST_ID_DB) as PlaylistId;
      prismaMock.playlistSorting.findFirst.mockRejectedValue(new Error('DB error'));

      await expect(repo.verifyExistence(playlistId)).rejects.toThrow('DB error');
    });

    it('createdById scope: findFirst is called with current user in where', async () => {
      const playlistId = models.playlist.id(PLAYLIST_ID_DB) as PlaylistId;
      prismaMock.playlistSorting.findFirst.mockResolvedValue(null);

      await repo.verifyExistence(playlistId);

      expect(prismaMock.playlistSorting.findFirst).toHaveBeenCalledWith({
        where: { playlistId: PLAYLIST_ID_DB, createdById: TEST_USER_ID },
      });
    });
  });
});
