import { Test } from '@nestjs/testing';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { SavedFilterQuery } from 'src/adapters/persistence/queries/saved-filter/saved-filter.query';
import { createMockPrisma } from '../../repositories/_test-utils/prisma-mock';
import { models } from 'src/kernel/types';
import type { StaticFilterOptions } from 'src/application/ports/queries/ISavedFilterQuery';
import { getCurrentUserId } from 'src/kernel/types/context';

const TEST_USER_ID = 'test-user-id';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: 'User:test-user-id' })),
}));

type RawRow = {
  id: string;
  name: string;
  type: keyof StaticFilterOptions;
};

function makeRawRows(overrides: Partial<RawRow>[] = []): RawRow[] {
  const defaults: RawRow[] = [
    { id: 'genre-1', name: 'Rock', type: 'genres' },
    { id: 'subgenre-1', name: 'Indie', type: 'subgenres' },
    { id: 'C', name: 'C', type: 'keys' },
    { id: 'lib-1', name: 'My Library', type: 'libraries' },
  ];
  if (overrides.length === 0) return defaults;
  return overrides as RawRow[];
}

describe('SavedFilterQuery', () => {
  let query: SavedFilterQuery;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    vi.clearAllMocks();
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [SavedFilterQuery, { provide: PRISMA_SERVICE, useValue: prismaMock }],
    }).compile();
    query = module.get(SavedFilterQuery);
  });

  describe('getStaticFilterOptions', () => {
    it('optimal: returns grouped static filter options with correct domain ids', async () => {
      const rows = makeRawRows();
      prismaMock.$queryRaw.mockResolvedValue(rows);

      const result = await query.getStaticFilterOptions();

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual({
        genres: [{ id: models.genre.id('genre-1'), name: 'Rock' }],
        subgenres: [{ id: models.subgenre.id('subgenre-1'), name: 'Indie' }],
        keys: [{ id: 'C', name: 'C' }],
        libraries: [{ id: models.library.id('lib-1'), name: 'My Library' }],
      });
    });

    it('optimal: returns multiple items per type when raw returns many rows', async () => {
      const rows: RawRow[] = [
        { id: 'g1', name: 'Genre A', type: 'genres' },
        { id: 'g2', name: 'Genre B', type: 'genres' },
        { id: 'key1', name: 'key1', type: 'keys' },
      ];
      prismaMock.$queryRaw.mockResolvedValue(rows);

      const result = await query.getStaticFilterOptions();

      expect(result.genres).toHaveLength(2);
      expect(result.genres[0]).toEqual({
        id: models.genre.id('g1'),
        name: 'Genre A',
      });
      expect(result.genres[1]).toEqual({
        id: models.genre.id('g2'),
        name: 'Genre B',
      });
      expect(result.keys).toHaveLength(1);
      expect(result.subgenres).toEqual([]);
      expect(result.libraries).toEqual([]);
    });

    it('failure: rethrows when Prisma $queryRaw throws', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('Connection lost'));

      await expect(query.getStaticFilterOptions()).rejects.toThrow('Connection lost');
    });

    it('createdById scope: getCurrentUserId is invoked when running query', async () => {
      prismaMock.$queryRaw.mockResolvedValue(makeRawRows());

      await query.getStaticFilterOptions();

      expect(getCurrentUserId).toHaveBeenCalled();
    });

    it('empty result: returns all empty arrays when raw returns no rows', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      const result = await query.getStaticFilterOptions();

      expect(result).toEqual({
        genres: [],
        subgenres: [],
        keys: [],
        libraries: [],
      });
    });
  });
});
