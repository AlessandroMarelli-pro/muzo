import { Test } from '@nestjs/testing';
import { MusicLibrary as PrismaMusicLibrary, ScanStatus as PrismaScanStatus } from '@prisma/client';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { MusicLibraryRepository } from 'src/adapters/persistence/repositories/music-library/music-library.repository';
import { createMockPrisma } from '../_test-utils/prisma-mock';
import { models } from 'src/kernel/types/models';
import type { MusicLibrary } from 'src/kernel/types/model-types';
import { MusicLibraryId } from 'src/kernel/ids';

const TEST_USER_ID = 'test-user-id';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => 'test-user-id'),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: 'User:test-user-id' })),
}));

function makePrismaLibraryRow(overrides: Partial<PrismaMusicLibrary> = {}): PrismaMusicLibrary {
  return {
    id: 'lib-1',
    name: 'Test Library',
    rootPath: '/music',
    totalTracks: 0,
    analyzedTracks: 0,
    pendingTracks: 0,
    failedTracks: 0,
    lastScanAt: null,
    lastIncrementalScanAt: null,
    scanStatus: PrismaScanStatus.IDLE,
    autoScan: true,
    scanInterval: 24,
    includeSubdirectories: true,
    supportedFormats: 'MP3,FLAC,WAV',
    maxFileSize: 100 * 1024 * 1024,
    createdAt: new Date(),
    createdById: TEST_USER_ID,
    updatedAt: null,
    updatedById: null,
    ...overrides,
  };
}

function makeDomainLibrary(overrides: Partial<MusicLibrary> = {}): MusicLibrary {
  return {
    id: models.musicLibrary.id('lib-1'),
    createdAt: new Date(),
    createdById: models.user.id(TEST_USER_ID),
    updatedAt: undefined,
    updatedById: undefined,
    name: 'Test Library',
    rootPath: '/music',
    tracksInfo: {
      totalTracks: 0,
      analyzedTracks: 0,
      pendingTracks: 0,
      failedTracks: 0,
    },
    scanInfo: {
      lastScanAt: null,
      lastIncrementalScanAt: null,
      scanStatus: 'IDLE',
    },
    settings: {
      autoScan: true,
      scanInterval: 24,
      includeSubdirectories: true,
      supportedFormats: ['MP3', 'FLAC', 'WAV'],
      maxFileSize: 100 * 1024 * 1024,
    },
    ...overrides,
  };
}

describe('MusicLibraryRepository', () => {
  let repo: MusicLibraryRepository;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [MusicLibraryRepository, { provide: PRISMA_SERVICE, useValue: prismaMock }],
    }).compile();
    repo = module.get(MusicLibraryRepository);
  });

  describe('save', () => {
    it('optimal: creates a library and returns domain model', async () => {
      const domain = makeDomainLibrary();
      const row = makePrismaLibraryRow({
        id: 'lib-1',
        name: domain.name,
        rootPath: domain.rootPath,
      });
      prismaMock.musicLibrary.create.mockResolvedValue(row);

      const result = await repo.save(domain);

      expect(prismaMock.musicLibrary.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'lib-1',
          name: domain.name,
          rootPath: domain.rootPath,
          createdById: TEST_USER_ID,
        }),
      });
      expect(result.id).toBeDefined();
      expect(result.name).toBe(domain.name);
      expect(result.rootPath).toBe(domain.rootPath);
    });

    it('failure: rethrows when Prisma create throws', async () => {
      const domain = makeDomainLibrary();
      const prismaError = new Error('Unique constraint failed');
      prismaMock.musicLibrary.create.mockRejectedValue(prismaError);

      await expect(repo.save(domain)).rejects.toThrow('Unique constraint failed');
    });

    it('createdById scope: create is called with current user id in data', async () => {
      const domain = makeDomainLibrary();
      const row = makePrismaLibraryRow();
      prismaMock.musicLibrary.create.mockResolvedValue(row);

      await repo.save(domain);

      expect(prismaMock.musicLibrary.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ createdById: TEST_USER_ID }),
      });
    });
  });

  describe('getOneById', () => {
    it('optimal: returns library when found', async () => {
      const libraryId = models.musicLibrary.id('lib-1') as MusicLibraryId;
      const row = makePrismaLibraryRow({ id: 'lib-1' });
      prismaMock.musicLibrary.findUniqueOrThrow.mockResolvedValue(row);

      const result = await repo.getOneById(libraryId);

      expect(prismaMock.musicLibrary.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'lib-1', createdById: TEST_USER_ID },
      });
      expect(result.name).toBe(row.name);
      expect(result.rootPath).toBe(row.rootPath);
    });

    it('failure: throws NotFoundError when Prisma throws P2025 (record not found)', async () => {
      const libraryId = models.musicLibrary.id('lib-missing') as MusicLibraryId;
      prismaMock.musicLibrary.findUniqueOrThrow.mockRejectedValue({
        code: 'P2025',
      });

      await expect(repo.getOneById(libraryId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: 'Music library with ID MusicLibrary:lib-missing not found',
      });
    });

    it('failure: rethrows when Prisma throws non-P2025 error', async () => {
      const libraryId = models.musicLibrary.id('lib-1') as MusicLibraryId;
      prismaMock.musicLibrary.findUniqueOrThrow.mockRejectedValue(new Error('Connection lost'));

      await expect(repo.getOneById(libraryId)).rejects.toThrow('Connection lost');
    });

    it('createdById scope: findUniqueOrThrow is called with current user in where', async () => {
      const libraryId = models.musicLibrary.id('lib-1') as MusicLibraryId;
      const row = makePrismaLibraryRow();
      prismaMock.musicLibrary.findUniqueOrThrow.mockResolvedValue(row);

      await repo.getOneById(libraryId);

      expect(prismaMock.musicLibrary.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'lib-1', createdById: TEST_USER_ID },
      });
    });

    it('empty result: not found yields NotFoundError (P2025)', async () => {
      const libraryId = models.musicLibrary.id('lib-nonexistent') as MusicLibraryId;
      prismaMock.musicLibrary.findUniqueOrThrow.mockRejectedValue({
        code: 'P2025',
      });

      await expect(repo.getOneById(libraryId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: expect.stringContaining('lib-nonexistent'),
      });
    });
  });

  describe('getMany', () => {
    it('optimal: returns all libraries for current user', async () => {
      const rows = [
        makePrismaLibraryRow({ id: 'lib-1' }),
        makePrismaLibraryRow({ id: 'lib-2', name: 'Lib 2' }),
      ];
      prismaMock.musicLibrary.findMany.mockResolvedValue(rows);

      const result = await repo.getMany();

      expect(prismaMock.musicLibrary.findMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Test Library');
      expect(result[1].name).toBe('Lib 2');
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      prismaMock.musicLibrary.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getMany()).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      prismaMock.musicLibrary.findMany.mockResolvedValue([]);

      await repo.getMany();

      expect(prismaMock.musicLibrary.findMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
      });
    });

    it('empty result: returns empty array when no libraries', async () => {
      prismaMock.musicLibrary.findMany.mockResolvedValue([]);

      const result = await repo.getMany();

      expect(result).toEqual([]);
    });
  });

  describe('updateOneById', () => {
    it('optimal: updates library and returns domain model', async () => {
      const libraryId = models.musicLibrary.id('lib-1') as MusicLibraryId;
      const updatedRow = makePrismaLibraryRow({
        id: 'lib-1',
        name: 'Updated Name',
      });
      prismaMock.musicLibrary.update.mockResolvedValue(updatedRow);

      const result = await repo.updateOneById(libraryId, {
        name: 'Updated Name',
      });

      expect(prismaMock.musicLibrary.update).toHaveBeenCalledWith({
        where: { id: 'lib-1', createdById: TEST_USER_ID },
        data: expect.any(Object),
      });
      expect(result.name).toBe('Updated Name');
    });

    it('failure: rethrows when Prisma update throws (e.g. P2025 not found)', async () => {
      const libraryId = models.musicLibrary.id('lib-missing') as MusicLibraryId;
      prismaMock.musicLibrary.update.mockRejectedValue({ code: 'P2025' });

      await expect(repo.updateOneById(libraryId, { name: 'X' })).rejects.toMatchObject({
        code: 'P2025',
      });
    });

    it('createdById scope: update is called with current user in where', async () => {
      const libraryId = models.musicLibrary.id('lib-1') as MusicLibraryId;
      const updatedRow = makePrismaLibraryRow({ id: 'lib-1' });
      prismaMock.musicLibrary.update.mockResolvedValue(updatedRow);

      await repo.updateOneById(libraryId, { name: 'New Name' });

      expect(prismaMock.musicLibrary.update).toHaveBeenCalledWith({
        where: { id: 'lib-1', createdById: TEST_USER_ID },
        data: expect.any(Object),
      });
    });
  });

  describe('deleteOneById', () => {
    it('optimal: deletes library and returns true', async () => {
      const libraryId = models.musicLibrary.id('lib-1') as MusicLibraryId;
      prismaMock.musicLibrary.delete.mockResolvedValue(makePrismaLibraryRow());

      const result = await repo.deleteOneById(libraryId);

      expect(prismaMock.musicLibrary.delete).toHaveBeenCalledWith({
        where: { id: 'lib-1', createdById: TEST_USER_ID },
      });
      expect(result).toBe(true);
    });

    it('failure: rethrows when Prisma delete throws (e.g. P2025 not found)', async () => {
      const libraryId = models.musicLibrary.id('lib-missing') as MusicLibraryId;
      prismaMock.musicLibrary.delete.mockRejectedValue({ code: 'P2025' });

      await expect(repo.deleteOneById(libraryId)).rejects.toMatchObject({
        code: 'P2025',
      });
    });

    it('createdById scope: delete is called with current user in where', async () => {
      const libraryId = models.musicLibrary.id('lib-1') as MusicLibraryId;
      prismaMock.musicLibrary.delete.mockResolvedValue(makePrismaLibraryRow());

      await repo.deleteOneById(libraryId);

      expect(prismaMock.musicLibrary.delete).toHaveBeenCalledWith({
        where: { id: 'lib-1', createdById: TEST_USER_ID },
      });
    });
  });

  describe('updateScanStatus', () => {
    it('optimal: updates scan status to SCANNING and returns domain model', async () => {
      const libraryId = models.musicLibrary.id('lib-1') as MusicLibraryId;
      const updatedRow = makePrismaLibraryRow({
        id: 'lib-1',
        scanStatus: PrismaScanStatus.SCANNING,
      });
      prismaMock.musicLibrary.update.mockResolvedValue(updatedRow);

      const result = await repo.updateScanStatus(libraryId, 'SCANNING');

      expect(prismaMock.musicLibrary.update).toHaveBeenCalledWith({
        where: { id: 'lib-1', createdById: TEST_USER_ID },
        data: expect.objectContaining({
          scanStatus: 'SCANNING',
        }),
      });
      expect(result.scanInfo.scanStatus).toBe('SCANNING');
    });

    it('failure: rethrows when Prisma update throws (e.g. P2025 not found)', async () => {
      const libraryId = models.musicLibrary.id('lib-missing') as MusicLibraryId;
      prismaMock.musicLibrary.update.mockRejectedValue({ code: 'P2025' });

      await expect(repo.updateScanStatus(libraryId, 'SCANNING')).rejects.toMatchObject({
        code: 'P2025',
      });
    });

    it('createdById scope: update is called with current user in where', async () => {
      const libraryId = models.musicLibrary.id('lib-1') as MusicLibraryId;
      const updatedRow = makePrismaLibraryRow({
        id: 'lib-1',
        scanStatus: PrismaScanStatus.SCANNING,
      });
      prismaMock.musicLibrary.update.mockResolvedValue(updatedRow);

      await repo.updateScanStatus(libraryId, 'SCANNING');

      expect(prismaMock.musicLibrary.update).toHaveBeenCalledWith({
        where: { id: 'lib-1', createdById: TEST_USER_ID },
        data: expect.any(Object),
      });
    });
  });
});
