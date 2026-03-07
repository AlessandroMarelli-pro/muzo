import { Test } from '@nestjs/testing';
import { Playlist as PrismaPlaylist } from '@prisma/client';
import { PlaylistRepository } from 'src/adapters/persistence/repositories/playlist/playlist.repository';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { PlaylistId } from 'src/kernel/ids';
import type { Playlist } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { createMockPrisma } from '../_test-utils/prisma-mock';

const TEST_USER_ID = 'test-user-id';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: 'User:test-user-id' })),
}));

function makePrismaPlaylistRow(overrides: Partial<PrismaPlaylist> = {}): PrismaPlaylist {
  return {
    id: 'playlist-1',
    name: 'Test Playlist',
    description: null,
    userId: null,
    isPublic: false,
    isFavorite: false,
    createdAt: new Date(),
    createdById: TEST_USER_ID,
    updatedAt: null,
    updatedById: null,
    ...overrides,
  };
}

function makeDomainPlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: models.playlist.id('playlist-1'),
    createdAt: new Date(),
    createdById: models.user.id(TEST_USER_ID),
    updatedAt: undefined,
    updatedById: undefined,
    name: 'Test Playlist',
    description: null,
    isPublic: false,
    isFavorite: false,
    ...overrides,
  };
}

describe('PlaylistRepository', () => {
  let repo: PlaylistRepository;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [PlaylistRepository, { provide: PRISMA_SERVICE, useValue: prismaMock }],
    }).compile();
    repo = module.get(PlaylistRepository);
  });

  describe('save', () => {
    it('optimal: creates a playlist and returns domain model', async () => {
      const domain = makeDomainPlaylist();
      const row = makePrismaPlaylistRow({
        id: 'playlist-1',
        name: domain.name,
        description: domain.description ?? null,
      });
      prismaMock.playlist.create.mockResolvedValue(row);

      const result = await repo.save(domain);

      expect(prismaMock.playlist.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'playlist-1',
          name: domain.name,
          description: domain.description ?? null,
          isPublic: domain.isPublic,
          isFavorite: domain.isFavorite,
          createdById: TEST_USER_ID,
        }),
      });
      expect(result.id).toBeDefined();
      expect(result.name).toBe(domain.name);
    });

    it('failure: rethrows when Prisma create throws', async () => {
      const domain = makeDomainPlaylist();
      const prismaError = new Error('Unique constraint failed');
      prismaMock.playlist.create.mockRejectedValue(prismaError);

      await expect(repo.save(domain)).rejects.toThrow('Unique constraint failed');
    });

    it('createdById scope: create is called with current user id in data', async () => {
      const domain = makeDomainPlaylist();
      const row = makePrismaPlaylistRow();
      prismaMock.playlist.create.mockResolvedValue(row);

      await repo.save(domain);

      expect(prismaMock.playlist.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ createdById: TEST_USER_ID }),
      });
    });
  });

  describe('getOneById', () => {
    it('optimal: returns playlist with sorting when found', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const row = makePrismaPlaylistRow({ id: 'playlist-1' }) as any;
      row.sorting = null;
      prismaMock.playlist.findFirstOrThrow.mockResolvedValue(row);

      const result = await repo.getOneById(playlistId);

      expect(prismaMock.playlist.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 'playlist-1', createdById: TEST_USER_ID },
        include: { sorting: true },
      });
      expect(result.name).toBe(row.name);
    });

    it('failure: throws NotFoundError when Prisma throws P2025 (record not found)', async () => {
      const playlistId = models.playlist.id('playlist-missing') as PlaylistId;
      prismaMock.playlist.findFirstOrThrow.mockRejectedValue({ code: 'P2025' });

      await expect(repo.getOneById(playlistId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: 'Playlist with ID Playlist:playlist-missing not found',
      });
    });

    it('failure: rethrows when Prisma throws non-P2025 error', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlist.findFirstOrThrow.mockRejectedValue(new Error('Connection lost'));

      await expect(repo.getOneById(playlistId)).rejects.toThrow('Connection lost');
    });

    it('createdById scope: findFirstOrThrow is called with current user in where', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const row = makePrismaPlaylistRow() as any;
      row.sorting = null;
      prismaMock.playlist.findFirstOrThrow.mockResolvedValue(row);

      await repo.getOneById(playlistId);

      expect(prismaMock.playlist.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 'playlist-1', createdById: TEST_USER_ID },
        include: { sorting: true },
      });
    });

    it('empty result: not found yields NotFoundError (P2025)', async () => {
      const playlistId = models.playlist.id('playlist-nonexistent') as PlaylistId;
      prismaMock.playlist.findFirstOrThrow.mockRejectedValue({ code: 'P2025' });

      await expect(repo.getOneById(playlistId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: expect.stringContaining('playlist-nonexistent'),
      });
    });
  });

  describe('getOneByIdWithTracks', () => {
    it('optimal: returns playlist with tracks and sorting when found', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const row = makePrismaPlaylistRow({ id: 'playlist-1' }) as any;
      row.sorting = null;
      row.tracks = [];
      prismaMock.playlist.findFirstOrThrow.mockResolvedValue(row);

      const result = await repo.getOneByIdWithTracks(playlistId, null);

      expect(prismaMock.playlist.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 'playlist-1', createdById: TEST_USER_ID },
        include: expect.objectContaining({
          sorting: true,
          tracks: expect.any(Object),
        }),
      });
      expect(result.name).toBe(row.name);
      expect(result.tracks).toEqual([]);
    });

    it('optimal: passes sorting options when provided', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const row = makePrismaPlaylistRow({ id: 'playlist-1' }) as any;
      row.sorting = null;
      row.tracks = [];
      prismaMock.playlist.findFirstOrThrow.mockResolvedValue(row);

      await repo.getOneByIdWithTracks(playlistId, {
        sortingKey: 'addedAt',
        sortingDirection: 'desc',
      });

      expect(prismaMock.playlist.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 'playlist-1', createdById: TEST_USER_ID },
        include: expect.objectContaining({
          sorting: true,
          tracks: expect.objectContaining({
            orderBy: { addedAt: 'desc' },
          }),
        }),
      });
    });

    it('failure: throws NotFoundError when Prisma throws P2025', async () => {
      const playlistId = models.playlist.id('playlist-missing') as PlaylistId;
      prismaMock.playlist.findFirstOrThrow.mockRejectedValue({ code: 'P2025' });

      await expect(repo.getOneByIdWithTracks(playlistId, null)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: 'Playlist with ID Playlist:playlist-missing not found',
      });
    });

    it('createdById scope: findFirstOrThrow is called with current user in where', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const row = makePrismaPlaylistRow() as any;
      row.sorting = null;
      row.tracks = [];
      prismaMock.playlist.findFirstOrThrow.mockResolvedValue(row);

      await repo.getOneByIdWithTracks(playlistId, null);

      expect(prismaMock.playlist.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 'playlist-1', createdById: TEST_USER_ID },
        include: expect.any(Object),
      });
    });

    it('empty result: not found yields NotFoundError (P2025)', async () => {
      const playlistId = models.playlist.id('playlist-nonexistent') as PlaylistId;
      prismaMock.playlist.findFirstOrThrow.mockRejectedValue({ code: 'P2025' });

      await expect(repo.getOneByIdWithTracks(playlistId, null)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: expect.stringContaining('playlist-nonexistent'),
      });
    });
  });

  describe('getFavorite', () => {
    it('optimal: returns favorite playlist with tracks when found', async () => {
      const row = makePrismaPlaylistRow({
        id: 'fav-1',
        isFavorite: true,
      }) as any;
      row.sorting = null;
      row.tracks = [];
      prismaMock.playlist.findFirstOrThrow.mockResolvedValue(row);

      const result = await repo.getFavorite();

      expect(prismaMock.playlist.findFirstOrThrow).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID, isFavorite: true },
        include: expect.objectContaining({
          sorting: true,
          tracks: expect.any(Object),
        }),
      });
      expect(result.name).toBe(row.name);
      expect(result.isFavorite).toBe(true);
    });

    it('failure: throws NotFoundError when Prisma throws P2025 (no favorite)', async () => {
      prismaMock.playlist.findFirstOrThrow.mockRejectedValue({ code: 'P2025' });

      await expect(repo.getFavorite()).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: 'Favorite playlist not found',
      });
    });

    it('createdById scope: findFirstOrThrow is called with current user in where', async () => {
      const row = makePrismaPlaylistRow({ isFavorite: true }) as any;
      row.sorting = null;
      row.tracks = [];
      prismaMock.playlist.findFirstOrThrow.mockResolvedValue(row);

      await repo.getFavorite();

      expect(prismaMock.playlist.findFirstOrThrow).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID, isFavorite: true },
        include: expect.any(Object),
      });
    });

    it('empty result: no favorite yields NotFoundError (P2025)', async () => {
      prismaMock.playlist.findFirstOrThrow.mockRejectedValue({ code: 'P2025' });

      await expect(repo.getFavorite()).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: 'Favorite playlist not found',
      });
    });
  });

  describe('getMany', () => {
    it('optimal: returns all playlists for current user', async () => {
      const rows = [
        makePrismaPlaylistRow({ id: 'playlist-1' }),
        makePrismaPlaylistRow({ id: 'playlist-2', name: 'Playlist 2' }),
      ];
      prismaMock.playlist.findMany.mockResolvedValue(rows);

      const result = await repo.getMany();

      expect(prismaMock.playlist.findMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Test Playlist');
      expect(result[1].name).toBe('Playlist 2');
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      prismaMock.playlist.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getMany()).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      prismaMock.playlist.findMany.mockResolvedValue([]);

      await repo.getMany();

      expect(prismaMock.playlist.findMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('empty result: returns empty array when no playlists', async () => {
      prismaMock.playlist.findMany.mockResolvedValue([]);

      const result = await repo.getMany();

      expect(result).toEqual([]);
    });
  });

  describe('updateOneById', () => {
    it('optimal: updates playlist and returns domain model', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const updatedRow = makePrismaPlaylistRow({
        id: 'playlist-1',
        name: 'Updated Name',
      });
      prismaMock.playlist.update.mockResolvedValue(updatedRow);

      const result = await repo.updateOneById(playlistId, {
        name: 'Updated Name',
      });

      expect(prismaMock.playlist.update).toHaveBeenCalledWith({
        where: { id: 'playlist-1', createdById: TEST_USER_ID },
        data: expect.any(Object),
      });
      expect(result.name).toBe('Updated Name');
    });

    it('failure: throws NotFoundError when Prisma throws P2025', async () => {
      const playlistId = models.playlist.id('playlist-missing') as PlaylistId;
      prismaMock.playlist.update.mockRejectedValue({ code: 'P2025' });

      await expect(repo.updateOneById(playlistId, { name: 'X' })).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: 'Playlist with ID Playlist:playlist-missing not found',
      });
    });

    it('failure: rethrows when Prisma throws non-P2025 error', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlist.update.mockRejectedValue(new Error('Connection lost'));

      await expect(repo.updateOneById(playlistId, { name: 'X' })).rejects.toThrow(
        'Connection lost',
      );
    });

    it('createdById scope: update is called with current user in where', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const updatedRow = makePrismaPlaylistRow({ id: 'playlist-1' });
      prismaMock.playlist.update.mockResolvedValue(updatedRow);

      await repo.updateOneById(playlistId, { name: 'New Name' });

      expect(prismaMock.playlist.update).toHaveBeenCalledWith({
        where: { id: 'playlist-1', createdById: TEST_USER_ID },
        data: expect.any(Object),
      });
    });
  });

  describe('deleteOneById', () => {
    it('optimal: deletes playlist and returns true', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlist.delete.mockResolvedValue(makePrismaPlaylistRow());

      const result = await repo.deleteOneById(playlistId);

      expect(prismaMock.playlist.delete).toHaveBeenCalledWith({
        where: { id: 'playlist-1', createdById: TEST_USER_ID },
      });
      expect(result).toBe(true);
    });

    it('failure: throws NotFoundError when Prisma throws P2025', async () => {
      const playlistId = models.playlist.id('playlist-missing') as PlaylistId;
      prismaMock.playlist.delete.mockRejectedValue({ code: 'P2025' });

      await expect(repo.deleteOneById(playlistId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: 'Playlist with ID Playlist:playlist-missing not found',
      });
    });

    it('failure: rethrows when Prisma throws non-P2025 error', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlist.delete.mockRejectedValue(new Error('Constraint failed'));

      await expect(repo.deleteOneById(playlistId)).rejects.toThrow('Constraint failed');
    });

    it('createdById scope: delete is called with current user in where', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlist.delete.mockResolvedValue(makePrismaPlaylistRow());

      await repo.deleteOneById(playlistId);

      expect(prismaMock.playlist.delete).toHaveBeenCalledWith({
        where: { id: 'playlist-1', createdById: TEST_USER_ID },
      });
    });
  });

  describe('verifyAccess', () => {
    it('optimal: returns true when playlist exists for current user', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const row = makePrismaPlaylistRow();
      prismaMock.playlist.findFirstOrThrow.mockResolvedValue(row);

      const result = await repo.verifyAccess(playlistId);

      expect(prismaMock.playlist.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 'playlist-1', createdById: TEST_USER_ID },
      });
      expect(result).toBe(true);
    });

    it('failure: throws NotFoundError when Prisma throws P2025', async () => {
      const playlistId = models.playlist.id('playlist-missing') as PlaylistId;
      prismaMock.playlist.findFirstOrThrow.mockRejectedValue({ code: 'P2025' });

      await expect(repo.verifyAccess(playlistId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: 'Playlist with ID Playlist:playlist-missing not found',
      });
    });

    it('createdById scope: findFirstOrThrow is called with current user in where', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const row = makePrismaPlaylistRow();
      prismaMock.playlist.findFirstOrThrow.mockResolvedValue(row);

      await repo.verifyAccess(playlistId);

      expect(prismaMock.playlist.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 'playlist-1', createdById: TEST_USER_ID },
      });
    });

    it('empty result: not found yields NotFoundError (P2025)', async () => {
      const playlistId = models.playlist.id('playlist-nonexistent') as PlaylistId;
      prismaMock.playlist.findFirstOrThrow.mockRejectedValue({ code: 'P2025' });

      await expect(repo.verifyAccess(playlistId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: expect.stringContaining('playlist-nonexistent'),
      });
    });
  });
});
