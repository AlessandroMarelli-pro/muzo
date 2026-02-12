import { Test } from '@nestjs/testing';
import { MusicLibrary as PrismaMusicLibrary, ScanStatus as PrismaScanStatus } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { MusicLibraryRepository } from 'src/adapters/persistence/repositories/music-library/music-library.repository';
import { createMockPrisma } from '../_test-utils/prisma-mock';
import { models } from 'src/kernel/types/models';
import type { MusicLibrary } from 'src/kernel/types/model-types';
import { MusicLibraryId } from 'src/kernel/ids';

const TEST_USER_ID = 'test-user-id';

jest.mock('src/kernel/types/context', () => ({
  ...jest.requireActual('src/kernel/types/context'),
  getCurrentUserId: jest.fn(() => 'test-user-id'),
  now: jest.fn(() => new Date()),
  user: jest.fn(() => ({ id: 'User:test-user-id' })),
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
      providers: [
        MusicLibraryRepository,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    repo = module.get(MusicLibraryRepository);
  });

  describe('save', () => {
    it('creates a library and returns domain model', async () => {
      const domain = makeDomainLibrary();
      const row = makePrismaLibraryRow({ id: 'lib-1', name: domain.name, rootPath: domain.rootPath });
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
  });

  describe('getOneById', () => {
    it('returns library when found', async () => {
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

    it('throws NotFoundError when Prisma throws P2025', async () => {
      const libraryId = models.musicLibrary.id('lib-missing') as MusicLibraryId;
      prismaMock.musicLibrary.findUniqueOrThrow.mockRejectedValue({ code: 'P2025' });

      await expect(repo.getOneById(libraryId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: 'Music library with ID MusicLibrary:lib-missing not found',
      });
    });
  });

  describe('getMany', () => {
    it('returns all libraries for current user', async () => {
      const rows = [makePrismaLibraryRow({ id: 'lib-1' }), makePrismaLibraryRow({ id: 'lib-2', name: 'Lib 2' })];
      prismaMock.musicLibrary.findMany.mockResolvedValue(rows);

      const result = await repo.getMany();

      expect(prismaMock.musicLibrary.findMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Test Library');
      expect(result[1].name).toBe('Lib 2');
    });

    it('returns empty array when no libraries', async () => {
      prismaMock.musicLibrary.findMany.mockResolvedValue([]);

      const result = await repo.getMany();

      expect(result).toEqual([]);
    });
  });

  describe('updateOneById', () => {
    it('updates library and returns domain model', async () => {
      const libraryId = models.musicLibrary.id('lib-1') as MusicLibraryId;
      const updatedRow = makePrismaLibraryRow({ id: 'lib-1', name: 'Updated Name' });
      prismaMock.musicLibrary.update.mockResolvedValue(updatedRow);

      const result = await repo.updateOneById(libraryId, { name: 'Updated Name' });

      expect(prismaMock.musicLibrary.update).toHaveBeenCalledWith({
        where: { id: 'lib-1', createdById: TEST_USER_ID },
        data: expect.any(Object),
      });
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('deleteOneById', () => {
    it('deletes library and returns true', async () => {
      const libraryId = models.musicLibrary.id('lib-1') as MusicLibraryId;
      prismaMock.musicLibrary.delete.mockResolvedValue(makePrismaLibraryRow());

      const result = await repo.deleteOneById(libraryId);

      expect(prismaMock.musicLibrary.delete).toHaveBeenCalledWith({
        where: { id: 'lib-1', createdById: TEST_USER_ID },
      });
      expect(result).toBe(true);
    });
  });

  describe('updateScanStatus', () => {
    it('updates scan status to SCANNING and returns domain model', async () => {
      const libraryId = models.musicLibrary.id('lib-1') as MusicLibraryId;
      const updatedRow = makePrismaLibraryRow({ id: 'lib-1', scanStatus: PrismaScanStatus.SCANNING });
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
  });
});
