import { Test } from '@nestjs/testing';
import {
  AnalysisStatus as PrismaAnalysisStatus,
  MusicTrack as PrismaMusicTrack,
} from '@prisma/client';
import {
  PRISMA_SERVICE,
  PrismaService,
} from 'src/infrastructure/database/prisma.service';
import { MusicTrackRepository } from 'src/adapters/persistence/repositories/music-track/music-track.repository';
import { createMockPrisma } from '../_test-utils/prisma-mock';
import { models } from 'src/kernel/types/models';
import { MusicLibraryId, MusicTrackId } from 'src/kernel/ids';
import { AudioFileAnalysisStatusEnum } from 'src/kernel/types/model-types';
import type { MusicTrackUpdateData } from 'src/application/ports/repositories/IMusicTrackRepository';

const TEST_USER_ID = 'test-user-id';
const LIB_ID = 'lib-1';
/** Branded id passed to repo; Prisma receives this string as libraryId. */
const LIBRARY_ID_RAW = 'MusicLibrary:lib-1';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => 'test-user-id'),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: 'User:test-user-id' })),
}));

/** Minimal Prisma MusicTrack row with relations required by toDomain (include shape). */
function makePrismaTrackRow(
  overrides: Partial<PrismaMusicTrack> = {},
): PrismaMusicTrack & {
  audioFingerprint?: null;
  trackGenres?: never[];
  trackSubgenres?: never[];
  imageSearches?: never[];
} {
  return {
    id: 'track-1',
    filePath: '/music/song.mp3',
    fileName: 'song.mp3',
    fileSize: 1024,
    format: 'MP3',
    bitrate: null,
    sampleRate: null,
    fileCreatedAt: new Date(),
    duration: 120,
    originalTitle: 'Song',
    originalArtist: 'Artist',
    originalAlbum: null,
    originalYear: null,
    originalAlbumartist: null,
    originalDate: null,
    originalBpm: null,
    originalTrack_number: null,
    originalDisc_number: null,
    originalComment: null,
    originalComposer: null,
    originalCopyright: null,
    aiTitle: null,
    aiArtist: null,
    aiAlbum: null,
    aiConfidence: null,
    aiSubgenreConfidence: null,
    aiDescription: null,
    aiTags: null,
    vocalsDesc: null,
    atmosphereDesc: null,
    contextBackground: null,
    contextImpact: null,
    userTitle: null,
    userArtist: null,
    userAlbum: null,
    userTags: null,
    listeningCount: 0,
    lastPlayedAt: null,
    isFavorite: false,
    isLiked: false,
    isBanger: false,
    analysisStatus: PrismaAnalysisStatus.COMPLETED,
    analysisStartedAt: new Date(),
    analysisCompletedAt: new Date(),
    analysisError: null,
    hasMusicbrainz: null,
    hasDiscogs: null,
    createdAt: new Date(),
    createdById: TEST_USER_ID,
    updatedAt: null,
    updatedById: null,
    libraryId: LIB_ID,
    audioFingerprint: undefined,
    trackGenres: [],
    trackSubgenres: [],
    imageSearches: [],
    ...overrides,
  } as PrismaMusicTrack & {
    audioFingerprint?: null;
    trackGenres?: never[];
    trackSubgenres?: never[];
    imageSearches?: never[];
  };
}

function makeUpsertData(overrides: Partial<MusicTrackUpdateData> = {}): MusicTrackUpdateData {
  return {
    filePath: '/music/song.mp3',
    fileName: 'song.mp3',
    fileSize: 1024,
    format: 'MP3',
    duration: 120,
    fileCreatedAt: new Date(),
    libraryId: models.musicLibrary.id(LIB_ID) as MusicLibraryId,
    analysisStatus: AudioFileAnalysisStatusEnum.COMPLETED,
    analysisStartedAt: new Date(),
    analysisCompletedAt: new Date(),
    analysisError: '',
    ...overrides,
  };
}

describe('MusicTrackRepository', () => {
  let repo: MusicTrackRepository;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        MusicTrackRepository,
        { provide: PRISMA_SERVICE, useValue: prismaMock },
      ],
    }).compile();
    repo = module.get(MusicTrackRepository);
  });

  describe('getManyByLibraryId', () => {
    it('optimal: returns tracks for library', async () => {
      const libraryId = models.musicLibrary.id(LIB_ID) as MusicLibraryId;
      const rows = [makePrismaTrackRow({ id: 't1' }), makePrismaTrackRow({ id: 't2' })];
      prismaMock.musicTrack.findMany.mockResolvedValue(rows);

      const result = await repo.getManyByLibraryId(libraryId);

      expect(prismaMock.musicTrack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { libraryId: LIBRARY_ID_RAW, createdById: TEST_USER_ID },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      const libraryId = models.musicLibrary.id(LIB_ID) as MusicLibraryId;
      prismaMock.musicTrack.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getManyByLibraryId(libraryId)).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      const libraryId = models.musicLibrary.id(LIB_ID) as MusicLibraryId;
      prismaMock.musicTrack.findMany.mockResolvedValue([]);

      await repo.getManyByLibraryId(libraryId);

      expect(prismaMock.musicTrack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { libraryId: LIBRARY_ID_RAW, createdById: TEST_USER_ID },
        }),
      );
    });

    it('empty result: returns empty array when no tracks', async () => {
      const libraryId = models.musicLibrary.id(LIB_ID) as MusicLibraryId;
      prismaMock.musicTrack.findMany.mockResolvedValue([]);

      const result = await repo.getManyByLibraryId(libraryId);

      expect(result).toEqual([]);
    });
  });

  describe('getOneById', () => {
    it('optimal: returns track when found', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      const row = makePrismaTrackRow({ id: 'track-1' });
      prismaMock.musicTrack.findUniqueOrThrow.mockResolvedValue(row);

      const result = await repo.getOneById(trackId);

      expect(prismaMock.musicTrack.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'track-1', createdById: TEST_USER_ID },
        }),
      );
      expect(result.id).toBeDefined();
      expect(result.fileInfo.filePath).toBe(row.filePath);
    });

    it('failure: throws NotFoundError when Prisma throws P2025', async () => {
      const trackId = models.musicTrack.id('track-missing') as MusicTrackId;
      prismaMock.musicTrack.findUniqueOrThrow.mockRejectedValue({ code: 'P2025' });

      await expect(repo.getOneById(trackId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: expect.stringContaining('track-missing'),
      });
    });

    it('failure: rethrows when Prisma throws non-P2025 error', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.musicTrack.findUniqueOrThrow.mockRejectedValue(new Error('Connection lost'));

      await expect(repo.getOneById(trackId)).rejects.toThrow('Connection lost');
    });

    it('createdById scope: findUniqueOrThrow is called with current user in where', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.musicTrack.findUniqueOrThrow.mockResolvedValue(makePrismaTrackRow());

      await repo.getOneById(trackId);

      expect(prismaMock.musicTrack.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'track-1', createdById: TEST_USER_ID },
        }),
      );
    });

    it('empty result: not found yields NotFoundError (P2025)', async () => {
      const trackId = models.musicTrack.id('track-nonexistent') as MusicTrackId;
      prismaMock.musicTrack.findUniqueOrThrow.mockRejectedValue({ code: 'P2025' });

      await expect(repo.getOneById(trackId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: expect.stringContaining('track-nonexistent'),
      });
    });
  });

  describe('upsertOne', () => {
    it('optimal: upserts track and returns domain model', async () => {
      const data = makeUpsertData();
      const row = makePrismaTrackRow({ id: 'track-1', filePath: data.filePath });
      prismaMock.musicTrack.upsert.mockResolvedValue(row);

      const result = await repo.upsertOne(data);

      expect(prismaMock.musicTrack.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { filePath: data.filePath, createdById: TEST_USER_ID },
        }),
      );
      expect(result.id).toBeDefined();
      expect(result.fileInfo.filePath).toBe(data.filePath);
    });

    it('failure: rethrows when Prisma upsert throws', async () => {
      const data = makeUpsertData();
      prismaMock.musicTrack.upsert.mockRejectedValue(new Error('Constraint failed'));

      await expect(repo.upsertOne(data)).rejects.toThrow('Constraint failed');
    });

    it('createdById scope: upsert where and create use current user id', async () => {
      const data = makeUpsertData();
      prismaMock.musicTrack.upsert.mockResolvedValue(makePrismaTrackRow());

      await repo.upsertOne(data);

      expect(prismaMock.musicTrack.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { filePath: data.filePath, createdById: TEST_USER_ID },
        }),
      );
    });
  });

  describe('getAnalysisStatusForManyByLibraryId', () => {
    it('optimal: returns analysis status counts per library', async () => {
      const libraryId = models.musicLibrary.id(LIB_ID) as MusicLibraryId;
      prismaMock.musicTrack.groupBy.mockResolvedValue([
        { analysisStatus: PrismaAnalysisStatus.COMPLETED, _count: { id: 5 } },
        { analysisStatus: PrismaAnalysisStatus.PENDING, _count: { id: 2 } },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.musicTrack.groupBy>>);

      const result = await repo.getAnalysisStatusForManyByLibraryId(libraryId);

      expect(prismaMock.musicTrack.groupBy).toHaveBeenCalledWith({
        by: ['analysisStatus'],
        where: { libraryId: LIB_ID, createdById: TEST_USER_ID },
        _count: { id: true },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ analysisStatus: AudioFileAnalysisStatusEnum.COMPLETED, count: 5 });
    });

    it('failure: rethrows when Prisma groupBy throws', async () => {
      const libraryId = models.musicLibrary.id(LIB_ID) as MusicLibraryId;
      prismaMock.musicTrack.groupBy.mockRejectedValue(new Error('DB error'));

      await expect(repo.getAnalysisStatusForManyByLibraryId(libraryId)).rejects.toThrow('DB error');
    });

    it('createdById scope: groupBy is called with current user in where', async () => {
      const libraryId = models.musicLibrary.id(LIB_ID) as MusicLibraryId;
      prismaMock.musicTrack.groupBy.mockResolvedValue([]);

      await repo.getAnalysisStatusForManyByLibraryId(libraryId);

      expect(prismaMock.musicTrack.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { libraryId: LIB_ID, createdById: TEST_USER_ID },
        }),
      );
    });

    it('empty result: returns empty array when no tracks', async () => {
      const libraryId = models.musicLibrary.id(LIB_ID) as MusicLibraryId;
      prismaMock.musicTrack.groupBy.mockResolvedValue([]);

      const result = await repo.getAnalysisStatusForManyByLibraryId(libraryId);

      expect(result).toEqual([]);
    });
  });

  describe('areFilesAnalyzed', () => {
    it('optimal: returns isAnalyzed per file path', async () => {
      const filePaths = ['/a.mp3', '/b.mp3'];
      prismaMock.musicTrack.findMany.mockResolvedValue([
        makePrismaTrackRow({ filePath: '/a.mp3' }),
      ]);

      const result = await repo.areFilesAnalyzed(filePaths);

      expect(prismaMock.musicTrack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdById: TEST_USER_ID }),
        }),
      );
      expect(result).toHaveLength(2);
      expect(result.find((r) => r.filePath === '/a.mp3')?.isAnalyzed).toBe(true);
      expect(result.find((r) => r.filePath === '/b.mp3')?.isAnalyzed).toBe(false);
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      prismaMock.musicTrack.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.areFilesAnalyzed(['/a.mp3'])).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      prismaMock.musicTrack.findMany.mockResolvedValue([]);

      await repo.areFilesAnalyzed(['/a.mp3']);

      expect(prismaMock.musicTrack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdById: TEST_USER_ID }),
        }),
      );
    });

    it('empty result: returns all false when no matching tracks', async () => {
      prismaMock.musicTrack.findMany.mockResolvedValue([]);

      const result = await repo.areFilesAnalyzed(['/a.mp3', '/b.mp3']);

      expect(result).toEqual([
        { filePath: '/a.mp3', isAnalyzed: false },
        { filePath: '/b.mp3', isAnalyzed: false },
      ]);
    });
  });

  describe('getAll', () => {
    it('optimal: returns all tracks for current user', async () => {
      const rows = [makePrismaTrackRow({ id: 't1' })];
      prismaMock.musicTrack.findMany.mockResolvedValue(rows);

      const result = await repo.getAll();

      expect(prismaMock.musicTrack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdById: TEST_USER_ID },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      prismaMock.musicTrack.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getAll()).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      prismaMock.musicTrack.findMany.mockResolvedValue([]);

      await repo.getAll();

      expect(prismaMock.musicTrack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdById: TEST_USER_ID },
        }),
      );
    });

    it('empty result: returns empty array when no tracks', async () => {
      prismaMock.musicTrack.findMany.mockResolvedValue([]);

      const result = await repo.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getManyByIds', () => {
    it('optimal: returns tracks for given ids', async () => {
      const ids = [
        models.musicTrack.id('t1') as MusicTrackId,
        models.musicTrack.id('t2') as MusicTrackId,
      ];
      const rows = [makePrismaTrackRow({ id: 't1' }), makePrismaTrackRow({ id: 't2' })];
      prismaMock.musicTrack.findMany.mockResolvedValue(rows);

      const result = await repo.getManyByIds(ids);

      expect(prismaMock.musicTrack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ['t1', 't2'] },
            createdById: TEST_USER_ID,
          },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      const ids = [models.musicTrack.id('t1') as MusicTrackId];
      prismaMock.musicTrack.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getManyByIds(ids)).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      const ids = [models.musicTrack.id('t1') as MusicTrackId];
      prismaMock.musicTrack.findMany.mockResolvedValue([]);

      await repo.getManyByIds(ids);

      expect(prismaMock.musicTrack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdById: TEST_USER_ID }),
        }),
      );
    });

    it('empty result: returns empty array when no matches', async () => {
      const ids = [models.musicTrack.id('t1') as MusicTrackId];
      prismaMock.musicTrack.findMany.mockResolvedValue([]);

      const result = await repo.getManyByIds(ids);

      expect(result).toEqual([]);
    });
  });

  describe('verifyExistence', () => {
    it('optimal: returns true when track exists', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.musicTrack.findUnique.mockResolvedValue({ id: 'track-1' } as Awaited<
        ReturnType<typeof prismaMock.musicTrack.findUnique>
      >);

      const result = await repo.verifyExistence(trackId);

      expect(prismaMock.musicTrack.findUnique).toHaveBeenCalledWith({
        where: { id: 'track-1', createdById: TEST_USER_ID },
        select: { id: true },
      });
      expect(result).toBe(true);
    });

    it('optimal: returns false when track does not exist', async () => {
      const trackId = models.musicTrack.id('track-missing') as MusicTrackId;
      prismaMock.musicTrack.findUnique.mockResolvedValue(null);

      const result = await repo.verifyExistence(trackId);

      expect(result).toBe(false);
    });

    it('failure: rethrows when Prisma findUnique throws', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.musicTrack.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(repo.verifyExistence(trackId)).rejects.toThrow('DB error');
    });

    it('createdById scope: findUnique is called with current user in where', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.musicTrack.findUnique.mockResolvedValue(null);

      await repo.verifyExistence(trackId);

      expect(prismaMock.musicTrack.findUnique).toHaveBeenCalledWith({
        where: { id: 'track-1', createdById: TEST_USER_ID },
        select: { id: true },
      });
    });
  });

  describe('updateOneById', () => {
    it('optimal: updates track and returns domain model', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      const updatedRow = makePrismaTrackRow({ id: 'track-1', isFavorite: true });
      prismaMock.musicTrack.update.mockResolvedValue(updatedRow);

      const result = await repo.updateOneById(trackId, {
        ...makeUpsertData(),
        stats: { isFavorite: true },
      });

      expect(prismaMock.musicTrack.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'track-1', createdById: TEST_USER_ID },
        }),
      );
      expect(result.stats?.isFavorite).toBe(true);
    });

    it('failure: rethrows when Prisma update throws (e.g. P2025)', async () => {
      const trackId = models.musicTrack.id('track-missing') as MusicTrackId;
      prismaMock.musicTrack.update.mockRejectedValue({ code: 'P2025' });

      await expect(
        repo.updateOneById(trackId, { ...makeUpsertData(), stats: { isFavorite: true } }),
      ).rejects.toMatchObject({ code: 'P2025' });
    });

    it('createdById scope: update is called with current user in where', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.musicTrack.update.mockResolvedValue(makePrismaTrackRow());

      await repo.updateOneById(trackId, { ...makeUpsertData(), stats: { isLiked: true } });

      expect(prismaMock.musicTrack.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'track-1', createdById: TEST_USER_ID },
        }),
      );
    });
  });

  describe('removeOneById', () => {
    it('optimal: deletes track and returns true', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.musicTrack.delete.mockResolvedValue(makePrismaTrackRow());

      const result = await repo.removeOneById(trackId);

      expect(prismaMock.musicTrack.delete).toHaveBeenCalledWith({
        where: { id: 'track-1', createdById: TEST_USER_ID },
      });
      expect(result).toBe(true);
    });

    it('failure: rethrows when Prisma delete throws (e.g. P2025)', async () => {
      const trackId = models.musicTrack.id('track-missing') as MusicTrackId;
      prismaMock.musicTrack.delete.mockRejectedValue({ code: 'P2025' });

      await expect(repo.removeOneById(trackId)).rejects.toMatchObject({ code: 'P2025' });
    });

    it('createdById scope: delete is called with current user in where', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.musicTrack.delete.mockResolvedValue(makePrismaTrackRow());

      await repo.removeOneById(trackId);

      expect(prismaMock.musicTrack.delete).toHaveBeenCalledWith({
        where: { id: 'track-1', createdById: TEST_USER_ID },
      });
    });
  });

  describe('incrementListeningCount', () => {
    it('optimal: increments count and returns domain model', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      const row = makePrismaTrackRow({ id: 'track-1', listeningCount: 1 });
      prismaMock.musicTrack.update.mockResolvedValue(row);

      const result = await repo.incrementListeningCount(trackId);

      expect(prismaMock.musicTrack.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'track-1', createdById: TEST_USER_ID },
          data: expect.objectContaining({
            listeningCount: { increment: 1 },
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('failure: rethrows when Prisma update throws', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.musicTrack.update.mockRejectedValue({ code: 'P2025' });

      await expect(repo.incrementListeningCount(trackId)).rejects.toMatchObject({ code: 'P2025' });
    });

    it('createdById scope: update is called with current user in where', async () => {
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.musicTrack.update.mockResolvedValue(makePrismaTrackRow());

      await repo.incrementListeningCount(trackId);

      expect(prismaMock.musicTrack.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'track-1', createdById: TEST_USER_ID },
        }),
      );
    });
  });

  describe('getRandomTrackId', () => {
    it('optimal: returns a random track id when tracks exist', async () => {
      prismaMock.musicTrack.count.mockResolvedValue(10);
      prismaMock.musicTrack.findFirstOrThrow.mockResolvedValue(
        makePrismaTrackRow({ id: 'track-rand' }),
      );

      const result = await repo.getRandomTrackId();

      expect(prismaMock.musicTrack.count).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
      });
      expect(prismaMock.musicTrack.findFirstOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdById: TEST_USER_ID },
        }),
      );
      expect(result).toBeDefined();
    });

    it('failure: throws NotFoundError when no tracks (P2025)', async () => {
      prismaMock.musicTrack.count.mockResolvedValue(0);
      prismaMock.musicTrack.findFirstOrThrow.mockRejectedValue({ code: 'P2025' });

      await expect(repo.getRandomTrackId()).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: 'No music tracks found',
      });
    });

    it('createdById scope: count and findFirstOrThrow use current user in where', async () => {
      prismaMock.musicTrack.count.mockResolvedValue(1);
      prismaMock.musicTrack.findFirstOrThrow.mockResolvedValue(makePrismaTrackRow());

      await repo.getRandomTrackId();

      expect(prismaMock.musicTrack.count).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
      });
      expect(prismaMock.musicTrack.findFirstOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdById: TEST_USER_ID },
        }),
      );
    });
  });

  describe('getLastPlayedTrack', () => {
    it('optimal: returns last played track when found', async () => {
      const row = makePrismaTrackRow({ id: 'track-1', lastPlayedAt: new Date() });
      prismaMock.musicTrack.findFirst.mockResolvedValue(row);

      const result = await repo.getLastPlayedTrack();

      expect(prismaMock.musicTrack.findFirst).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
        orderBy: { lastPlayedAt: 'desc' },
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBeDefined();
      expect(result!.fileInfo.filePath).toBe(row.filePath);
    });

    it('failure: rethrows when Prisma findFirst throws', async () => {
      prismaMock.musicTrack.findFirst.mockRejectedValue(new Error('DB error'));

      await expect(repo.getLastPlayedTrack()).rejects.toThrow('DB error');
    });

    it('createdById scope: findFirst is called with current user in where', async () => {
      prismaMock.musicTrack.findFirst.mockResolvedValue(makePrismaTrackRow());

      await repo.getLastPlayedTrack();

      expect(prismaMock.musicTrack.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdById: TEST_USER_ID },
        }),
      );
    });

    it('empty result: returns null when no track has been played', async () => {
      prismaMock.musicTrack.findFirst.mockResolvedValue(null);

      const result = await repo.getLastPlayedTrack();

      expect(result).toBeNull();
    });
  });
});
