import { Test } from '@nestjs/testing';
import { AnalysisStatus as PrismaAnalysisStatus } from '@prisma/client';
import {
  PRISMA_SERVICE,
  PrismaService,
} from 'src/infrastructure/database/prisma.service';
import { MusicTrackQuery } from 'src/adapters/persistence/queries/music-track/music-track.query';
import { createMockPrisma } from '../../repositories/_test-utils/prisma-mock';
import { models } from 'src/kernel/types';
import type { PrismaMusicTrackWithRelations } from 'src/adapters/persistence/repositories/music-track/music-track.mapper';
import { getCurrentUserId } from 'src/kernel/types/context';

const TEST_USER_ID = 'test-user-id';
const TRACK_ID = 'track-1';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: 'User:test-user-id' })),
}));

type RawStatsRow = {
  likedCount: number;
  bangerCount: number;
  dislikedCount: number;
  remainingCount: number;
  trackId: string | null;
};

function makeRawStatsRow(overrides: Partial<RawStatsRow> = {}): RawStatsRow[] {
  return [
    {
      likedCount: 1,
      bangerCount: 0,
      dislikedCount: 2,
      remainingCount: 10,
      trackId: TRACK_ID,
      ...overrides,
    },
  ];
}

/** Minimal Prisma MusicTrack with relations so toDomain runs without throwing. */
function makePrismaTrackWithRelations(
  overrides: Partial<PrismaMusicTrackWithRelations> = {},
): PrismaMusicTrackWithRelations {
  return {
    id: TRACK_ID,
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
    aiTags: '[]',
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
    libraryId: 'lib-1',
    audioFingerprint: null,
    trackGenres: [],
    trackSubgenres: [],
    imageSearches: [],
    ...overrides,
  } as PrismaMusicTrackWithRelations;
}

describe('MusicTrackQuery', () => {
  let musicTrackQuery: MusicTrackQuery;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    vi.clearAllMocks();
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        MusicTrackQuery,
        { provide: PRISMA_SERVICE, useValue: prismaMock },
      ],
    }).compile();
    musicTrackQuery = module.get(MusicTrackQuery);
  });

  describe('getRandomTrackWithStats', () => {
    it('optimal: returns track and stats when raw row has trackId and findFirst returns track', async () => {
      const rawRows = makeRawStatsRow();
      const trackRow = makePrismaTrackWithRelations();
      prismaMock.$queryRaw.mockResolvedValue(rawRows);
      prismaMock.musicTrack.findFirst.mockResolvedValue(trackRow);

      const result = await musicTrackQuery.getRandomTrackWithStats();

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(prismaMock.musicTrack.findFirst).toHaveBeenCalledWith({
        where: { id: TRACK_ID, createdById: TEST_USER_ID },
        include: expect.any(Object),
      });
      expect(result.track).not.toBeNull();
      expect(result.track!.id).toBe(models.musicTrack.id(TRACK_ID));
      expect(result.likedCount).toBe(1);
      expect(result.bangerCount).toBe(0);
      expect(result.dislikedCount).toBe(2);
      expect(result.remainingCount).toBe(10);
    });

    it('optimal: returns track null and stats when raw row has trackId but findFirst returns null', async () => {
      const rawRows = makeRawStatsRow();
      prismaMock.$queryRaw.mockResolvedValue(rawRows);
      prismaMock.musicTrack.findFirst.mockResolvedValue(null);

      const result = await musicTrackQuery.getRandomTrackWithStats();

      expect(result.track).toBeNull();
      expect(result.likedCount).toBe(1);
      expect(result.dislikedCount).toBe(2);
    });

    it('failure: rethrows when Prisma $queryRaw throws', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('Connection lost'));

      await expect(musicTrackQuery.getRandomTrackWithStats()).rejects.toThrow(
        'Connection lost',
      );
    });

    it('failure: rethrows when Prisma findFirst throws', async () => {
      prismaMock.$queryRaw.mockResolvedValue(makeRawStatsRow());
      prismaMock.musicTrack.findFirst.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(musicTrackQuery.getRandomTrackWithStats()).rejects.toThrow(
        'DB error',
      );
    });

    it('createdById scope: findFirst is called with current user in where', async () => {
      prismaMock.$queryRaw.mockResolvedValue(makeRawStatsRow());
      prismaMock.musicTrack.findFirst.mockResolvedValue(
        makePrismaTrackWithRelations(),
      );

      await musicTrackQuery.getRandomTrackWithStats();

      expect(prismaMock.musicTrack.findFirst).toHaveBeenCalledWith({
        where: { id: TRACK_ID, createdById: TEST_USER_ID },
        include: expect.any(Object),
      });
    });

    it('createdById scope: getCurrentUserId is invoked when running query', async () => {
      prismaMock.$queryRaw.mockResolvedValue(makeRawStatsRow());
      prismaMock.musicTrack.findFirst.mockResolvedValue(
        makePrismaTrackWithRelations(),
      );

      await musicTrackQuery.getRandomTrackWithStats();

      expect(getCurrentUserId).toHaveBeenCalled();
    });

    it('empty result: returns track null when raw row trackId is null', async () => {
      const rawRows = makeRawStatsRow({ trackId: null });
      prismaMock.$queryRaw.mockResolvedValue(rawRows);
      prismaMock.musicTrack.findFirst.mockResolvedValue(null);

      const result = await musicTrackQuery.getRandomTrackWithStats();

      expect(prismaMock.musicTrack.findFirst).toHaveBeenCalledWith({
        where: { id: null, createdById: TEST_USER_ID },
        include: expect.any(Object),
      });
      expect(result.track).toBeNull();
      expect(result.likedCount).toBe(1);
    });
  });
});
