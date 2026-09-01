import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { MusicTrackRepository } from 'src/adapters/persistence/repositories/music-track/music-track.repository';
import { MUSIC_TRACK_REPOSITORY } from 'src/application/ports/repositories/IMusicTrackRepository';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import type { GenreId, MusicLibraryId } from 'src/kernel/ids';
import { models } from 'src/kernel/types/models';
import type { FilterCriteria } from 'src/kernel/types/model-types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIntegrationPrismaClient,
  setupIntegrationDb,
} from '../../application/use-cases/_test-utils/integration-db';

const TEST_USER_ID = 'test-user-id';
const OTHER_USER_ID = 'other-user-id';
const LIB_ID = 'lib-1';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  getCurrentUser: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
}));

const emptyCriteria = (): FilterCriteria => ({
  genreIds: null,
  subgenreIds: null,
  keyIds: null,
  tempo: null,
  valenceMood: null,
  arousalMood: null,
  danceabilityFeeling: null,
  instrumentalness: null,
  artist: null,
  title: null,
  libraryIds: null,
});

const pagination = { pagination: { limit: 50, offset: 0, orderBy: 'createdAt', orderDirection: 'desc' as const } };

describe('buildMusicTrackFilterWhereClause via MusicTrackRepository.getManyByCriteriaWithPagination', () => {
  let repo: MusicTrackRepository;
  let prisma: PrismaClient;
  let cleanupDb: () => Promise<void>;
  let genreId: string;

  beforeAll(async () => {
    const { cleanup } = await setupIntegrationDb();
    cleanupDb = cleanup;

    const dbUrl = process.env.DATABASE_URL!;
    const testPrisma = createIntegrationPrismaClient(dbUrl);
    await testPrisma.$connect();

    const module = await Test.createTestingModule({
      providers: [
        { provide: PRISMA_SERVICE, useValue: testPrisma },
        { provide: MUSIC_TRACK_REPOSITORY, useClass: MusicTrackRepository },
      ],
    }).compile();
    await module.init();

    repo = module.get(MUSIC_TRACK_REPOSITORY);
    prisma = module.get(PRISMA_SERVICE);
  });

  afterAll(async () => {
    await prisma?.$disconnect?.();
    await cleanupDb?.();
  });

  beforeEach(async () => {
    await prisma.audioFingerprint.deleteMany({});
    await prisma.trackGenre.deleteMany({});
    await prisma.musicTrack.deleteMany({});
    await prisma.genre.deleteMany({});
    await prisma.musicLibrary.deleteMany({});

    await prisma.musicLibrary.create({
      data: {
        id: LIB_ID,
        name: 'Test Library',
        rootPath: '/music',
        createdById: TEST_USER_ID,
      },
    });

    const genre = await prisma.genre.create({ data: { name: 'House' } });
    genreId = genre.id;

    // G minor, 120 BPM, energetic, House -- owned by TEST_USER
    await createTrack({
      id: 't-gminor',
      createdById: TEST_USER_ID,
      fingerprint: { key: 'G minor', tempo: 120, arousalMood: 'energetic' },
      genreId,
    });
    // A minor, 128 BPM, calm -- owned by TEST_USER
    await createTrack({
      id: 't-aminor',
      createdById: TEST_USER_ID,
      fingerprint: { key: 'A minor', tempo: 128, arousalMood: 'calm' },
    });
    // No AudioFingerprint row -- owned by TEST_USER
    await createTrack({ id: 't-nofp', createdById: TEST_USER_ID });
    // Matches G minor / 120 / energetic but owned by ANOTHER user
    await createTrack({
      id: 't-other-user',
      createdById: OTHER_USER_ID,
      fingerprint: { key: 'G minor', tempo: 120, arousalMood: 'energetic' },
    });
  });

  async function createTrack(opts: {
    id: string;
    createdById: string;
    fingerprint?: { key?: string; tempo?: number; arousalMood?: string };
    genreId?: string;
  }) {
    await prisma.musicTrack.create({
      data: {
        id: opts.id,
        filePath: `/music/${opts.id}.mp3`,
        fileName: `${opts.id}.mp3`,
        fileSize: 2048,
        format: 'mp3',
        fileCreatedAt: new Date(),
        duration: 180,
        analysisStatus: 'COMPLETED',
        analysisStartedAt: new Date(),
        analysisCompletedAt: new Date(),
        createdById: opts.createdById,
        libraryId: LIB_ID,
        ...(opts.fingerprint
          ? { audioFingerprint: { create: { ...opts.fingerprint } } }
          : {}),
        ...(opts.genreId ? { trackGenres: { create: { genreId: opts.genreId } } } : {}),
      },
    });
  }

  it('keyIds filters to the matching key and reports the scoped total', async () => {
    const res = await repo.getManyByCriteriaWithPagination(
      { ...emptyCriteria(), keyIds: ['G minor'] },
      pagination,
    );
    expect(res.items.map((t) => t.id)).toEqual([models.musicTrack.id('t-gminor')]);
    expect(res.total).toBe(1);
  });

  it('tempo range filters to tracks inside the range', async () => {
    const res = await repo.getManyByCriteriaWithPagination(
      { ...emptyCriteria(), tempo: { min: 125, max: 135 } },
      pagination,
    );
    expect(res.items.map((t) => t.id)).toEqual([models.musicTrack.id('t-aminor')]);
    expect(res.total).toBe(1);
  });

  it('arousalMood filters to tracks with that mood label', async () => {
    const res = await repo.getManyByCriteriaWithPagination(
      { ...emptyCriteria(), arousalMood: ['energetic'] },
      pagination,
    );
    expect(res.items.map((t) => t.id)).toEqual([models.musicTrack.id('t-gminor')]);
    expect(res.total).toBe(1);
  });

  it('no criteria returns every track for the current user, including the fingerprint-less one', async () => {
    const res = await repo.getManyByCriteriaWithPagination(emptyCriteria(), pagination);
    expect(res.items.map((t) => t.id).sort()).toEqual(
      ['t-aminor', 't-gminor', 't-nofp'].map((id) => models.musicTrack.id(id)).sort(),
    );
    expect(res.total).toBe(3);
  });

  it('genreIds still filters (regression guard for the working path)', async () => {
    const res = await repo.getManyByCriteriaWithPagination(
      { ...emptyCriteria(), genreIds: [models.genre.id(genreId) as GenreId] },
      pagination,
    );
    expect(res.items.map((t) => t.id)).toEqual([models.musicTrack.id('t-gminor')]);
    expect(res.total).toBe(1);
  });

  it('total reflects the filtered, user-scoped count -- not the table count', async () => {
    // The other-user track also matches this filter but must not be counted.
    const res = await repo.getManyByCriteriaWithPagination(
      { ...emptyCriteria(), keyIds: ['G minor'] },
      pagination,
    );
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
  });
});
