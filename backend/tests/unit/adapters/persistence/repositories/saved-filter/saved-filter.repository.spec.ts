import { Test } from '@nestjs/testing';
import { SavedFilter as PrismaSavedFilter } from '@prisma/client';
import {
  PRISMA_SERVICE,
  PrismaService,
} from 'src/infrastructure/database/prisma.service';
import { SavedFilterRepository } from 'src/adapters/persistence/repositories/saved-filter/saved-filter.repository';
import { createMockPrisma } from '../_test-utils/prisma-mock';
import { models } from 'src/kernel/types/models';
import type { SavedFilter } from 'src/kernel/types/model-types';
import { SavedFilterId } from 'src/kernel/ids';

const TEST_USER_ID = 'test-user-id';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: 'User:test-user-id' })),
}));

const defaultCriteria: SavedFilter['criteria'] = {
  genreIds: null,
  subgenreIds: null,
  keyIds: null,
  tempo: null,
  valenceMood: null,
  arousalMood: null,
  danceabilityFeeling: null,
  speechiness: null,
  instrumentalness: null,
  liveness: null,
  acousticness: null,
  artist: null,
  title: null,
  libraryIds: null,
  atmosphereIds: null,
};

function makePrismaSavedFilterRow(
  overrides: Partial<PrismaSavedFilter> = {},
): PrismaSavedFilter {
  return {
    id: 'saved-filter-1',
    name: 'My Filter',
    criteria: JSON.stringify(defaultCriteria),
    isCurrent: false,
    createdAt: new Date(),
    createdById: TEST_USER_ID,
    updatedAt: null,
    updatedById: null,
    ...overrides,
  };
}

function makeDomainSavedFilter(
  overrides: Partial<SavedFilter> = {},
): SavedFilter {
  return {
    id: models.savedFilter.id('saved-filter-1'),
    createdAt: new Date(),
    createdById: models.user.id(TEST_USER_ID),
    updatedAt: undefined,
    updatedById: undefined,
    name: 'My Filter',
    criteria: defaultCriteria,
    isCurrent: false,
    ...overrides,
  };
}

describe('SavedFilterRepository', () => {
  let repo: SavedFilterRepository;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        SavedFilterRepository,
        { provide: PRISMA_SERVICE, useValue: prismaMock },
      ],
    }).compile();
    repo = module.get(SavedFilterRepository);
  });

  describe('save', () => {
    it('optimal: creates a saved filter and returns domain model', async () => {
      const domain = makeDomainSavedFilter();
      const row = makePrismaSavedFilterRow({
        id: 'saved-filter-1',
        name: domain.name,
        criteria: JSON.stringify(domain.criteria),
      });
      prismaMock.savedFilter.create.mockResolvedValue(row);

      const result = await repo.save(domain);

      expect(prismaMock.savedFilter.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'saved-filter-1',
          name: domain.name,
          criteria: JSON.stringify(domain.criteria),
          isCurrent: domain.isCurrent,
          createdById: TEST_USER_ID,
        }),
      });
      expect(result.id).toBeDefined();
      expect(result.name).toBe(domain.name);
    });

    it('failure: rethrows when Prisma create throws', async () => {
      const domain = makeDomainSavedFilter();
      const prismaError = new Error('Unique constraint failed');
      prismaMock.savedFilter.create.mockRejectedValue(prismaError);

      await expect(repo.save(domain)).rejects.toThrow('Unique constraint failed');
    });

    it('createdById scope: create is called with current user id in data', async () => {
      const domain = makeDomainSavedFilter();
      const row = makePrismaSavedFilterRow();
      prismaMock.savedFilter.create.mockResolvedValue(row);

      await repo.save(domain);

      expect(prismaMock.savedFilter.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ createdById: TEST_USER_ID }),
      });
    });
  });

  describe('getById', () => {
    it('optimal: returns saved filter when found', async () => {
      const filterId = models.savedFilter.id('saved-filter-1') as SavedFilterId;
      const row = makePrismaSavedFilterRow({ id: 'saved-filter-1' });
      prismaMock.savedFilter.findUnique.mockResolvedValue(row);

      const result = await repo.getById(filterId);

      expect(prismaMock.savedFilter.findUnique).toHaveBeenCalledWith({
        where: { id: 'saved-filter-1', createdById: TEST_USER_ID },
      });
      expect(result).not.toBeNull();
      expect(result!.name).toBe(row.name);
    });

    it('failure: rethrows when Prisma findUnique throws', async () => {
      const filterId = models.savedFilter.id('saved-filter-1') as SavedFilterId;
      prismaMock.savedFilter.findUnique.mockRejectedValue(
        new Error('Connection lost'),
      );

      await expect(repo.getById(filterId)).rejects.toThrow('Connection lost');
    });

    it('createdById scope: findUnique is called with current user in where', async () => {
      const filterId = models.savedFilter.id('saved-filter-1') as SavedFilterId;
      const row = makePrismaSavedFilterRow();
      prismaMock.savedFilter.findUnique.mockResolvedValue(row);

      await repo.getById(filterId);

      expect(prismaMock.savedFilter.findUnique).toHaveBeenCalledWith({
        where: { id: 'saved-filter-1', createdById: TEST_USER_ID },
      });
    });

    it('empty result: returns null when not found', async () => {
      const filterId = models.savedFilter.id('saved-filter-nonexistent') as SavedFilterId;
      prismaMock.savedFilter.findUnique.mockResolvedValue(null);

      const result = await repo.getById(filterId);

      expect(result).toBeNull();
    });
  });

  describe('updateById', () => {
    it('optimal: updates saved filter and returns domain model', async () => {
      const filterId = models.savedFilter.id('saved-filter-1') as SavedFilterId;
      const updateData = makeDomainSavedFilter({ name: 'Updated Name' });
      const updatedRow = makePrismaSavedFilterRow({
        id: 'saved-filter-1',
        name: 'Updated Name',
      });
      prismaMock.savedFilter.update.mockResolvedValue(updatedRow);

      const result = await repo.updateById(filterId, updateData);

      expect(prismaMock.savedFilter.update).toHaveBeenCalledWith({
        where: { id: 'saved-filter-1', createdById: TEST_USER_ID },
        data: expect.any(Object),
      });
      expect(result.name).toBe('Updated Name');
    });

    it('failure: throws NotFoundError when Prisma throws P2025', async () => {
      const filterId = models.savedFilter.id('saved-filter-missing') as SavedFilterId;
      prismaMock.savedFilter.update.mockRejectedValue({ code: 'P2025' });

      await expect(
        repo.updateById(filterId, makeDomainSavedFilter()),
      ).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: 'Saved filter with ID SavedFilter:saved-filter-missing not found',
      });
    });

    it('failure: rethrows when Prisma throws non-P2025 error', async () => {
      const filterId = models.savedFilter.id('saved-filter-1') as SavedFilterId;
      prismaMock.savedFilter.update.mockRejectedValue(
        new Error('Connection lost'),
      );

      await expect(
        repo.updateById(filterId, makeDomainSavedFilter()),
      ).rejects.toThrow('Connection lost');
    });

    it('createdById scope: update is called with current user in where', async () => {
      const filterId = models.savedFilter.id('saved-filter-1') as SavedFilterId;
      const updatedRow = makePrismaSavedFilterRow({ id: 'saved-filter-1' });
      prismaMock.savedFilter.update.mockResolvedValue(updatedRow);

      await repo.updateById(filterId, makeDomainSavedFilter({ name: 'New Name' }));

      expect(prismaMock.savedFilter.update).toHaveBeenCalledWith({
        where: { id: 'saved-filter-1', createdById: TEST_USER_ID },
        data: expect.any(Object),
      });
    });
  });

  describe('getAll', () => {
    it('optimal: returns all saved filters for current user', async () => {
      const rows = [
        makePrismaSavedFilterRow({ id: 'sf-1' }),
        makePrismaSavedFilterRow({ id: 'sf-2', name: 'Filter 2' }),
      ];
      prismaMock.savedFilter.findMany.mockResolvedValue(rows);

      const result = await repo.getAll();

      expect(prismaMock.savedFilter.findMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('My Filter');
      expect(result[1].name).toBe('Filter 2');
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      prismaMock.savedFilter.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getAll()).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      prismaMock.savedFilter.findMany.mockResolvedValue([]);

      await repo.getAll();

      expect(prismaMock.savedFilter.findMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
      });
    });

    it('empty result: returns empty array when no saved filters', async () => {
      prismaMock.savedFilter.findMany.mockResolvedValue([]);

      const result = await repo.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('deleteById', () => {
    it('optimal: deletes saved filter and returns true', async () => {
      const filterId = models.savedFilter.id('saved-filter-1') as SavedFilterId;
      prismaMock.savedFilter.delete.mockResolvedValue(
        makePrismaSavedFilterRow(),
      );

      const result = await repo.deleteById(filterId);

      expect(prismaMock.savedFilter.delete).toHaveBeenCalledWith({
        where: { id: 'saved-filter-1', createdById: TEST_USER_ID },
      });
      expect(result).toBe(true);
    });

    it('failure: throws NotFoundError when Prisma throws P2025', async () => {
      const filterId = models.savedFilter.id('saved-filter-missing') as SavedFilterId;
      prismaMock.savedFilter.delete.mockRejectedValue({ code: 'P2025' });

      await expect(repo.deleteById(filterId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: 'Saved filter with ID SavedFilter:saved-filter-missing not found',
      });
    });

    it('failure: rethrows when Prisma throws non-P2025 error', async () => {
      const filterId = models.savedFilter.id('saved-filter-1') as SavedFilterId;
      prismaMock.savedFilter.delete.mockRejectedValue(
        new Error('Constraint failed'),
      );

      await expect(repo.deleteById(filterId)).rejects.toThrow(
        'Constraint failed',
      );
    });

    it('createdById scope: delete is called with current user in where', async () => {
      const filterId = models.savedFilter.id('saved-filter-1') as SavedFilterId;
      prismaMock.savedFilter.delete.mockResolvedValue(
        makePrismaSavedFilterRow(),
      );

      await repo.deleteById(filterId);

      expect(prismaMock.savedFilter.delete).toHaveBeenCalledWith({
        where: { id: 'saved-filter-1', createdById: TEST_USER_ID },
      });
    });
  });

  describe('getCurrentFilter', () => {
    it('optimal: returns current filter when found', async () => {
      const row = makePrismaSavedFilterRow({
        id: 'current-1',
        isCurrent: true,
      });
      prismaMock.savedFilter.findFirst.mockResolvedValue(row);

      const result = await repo.getCurrentFilter();

      expect(prismaMock.savedFilter.findFirst).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID, isCurrent: true },
      });
      expect(result).not.toBeNull();
      expect(result!.name).toBe(row.name);
      expect(result!.isCurrent).toBe(true);
    });

    it('failure: rethrows when Prisma findFirst throws', async () => {
      prismaMock.savedFilter.findFirst.mockRejectedValue(
        new Error('Connection lost'),
      );

      await expect(repo.getCurrentFilter()).rejects.toThrow('Connection lost');
    });

    it('createdById scope: findFirst is called with current user in where', async () => {
      const row = makePrismaSavedFilterRow({ isCurrent: true });
      prismaMock.savedFilter.findFirst.mockResolvedValue(row);

      await repo.getCurrentFilter();

      expect(prismaMock.savedFilter.findFirst).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID, isCurrent: true },
      });
    });

    it('empty result: returns null when no current filter', async () => {
      prismaMock.savedFilter.findFirst.mockResolvedValue(null);

      const result = await repo.getCurrentFilter();

      expect(result).toBeNull();
    });
  });
});
