import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { MusicLibraryRepository } from 'src/adapters/persistence/repositories/music-library/music-library.repository';
import { MusicTrackRepository } from 'src/adapters/persistence/repositories/music-track/music-track.repository';
import { ScanSessionRepository } from 'src/adapters/persistence/repositories/scan-session/scan-session.repository';
import type { FileInfo } from 'src/application/ports/dtos/FileInfo';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { MUSIC_LIBRARY_REPOSITORY } from 'src/application/ports/repositories/IMusicLibraryRepository';
import { MUSIC_TRACK_REPOSITORY } from 'src/application/ports/repositories/IMusicTrackRepository';
import { SCAN_SESSION_REPOSITORY } from 'src/application/ports/repositories/IScanSessionRepository';
import { ScheduleBatchAudioScanUseCase } from 'src/application/use-cases/job-scheduler/ScheduleBatchAudioScan';
import { ScheduleTracksByCriteriaScanUseCase } from 'src/application/use-cases/job-scheduler/ScheduleTracksByCriteriaScan';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { extractModelId } from 'src/kernel/ids/factory';
import type { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { models } from 'src/kernel/types/models';
import { AudioFileAnalysisStatusEnum, FilterCriteria } from 'src/kernel/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntegrationPrismaClient, setupIntegrationDb } from '../_test-utils/integration-db';
import { makeLibrary } from '../_test-utils/make-library';

const LIBRARY_1_ID = models.musicLibrary.id('lib-1') as MusicLibraryId;
const LIBRARY_2_ID = models.musicLibrary.id('lib-2') as MusicLibraryId;
const TEST_USER_ID = 'test-user-id';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  getCurrentUser: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
}));

/**
 * Fake ScheduleBatchAudioScanUseCase that records calls and returns the given sessionId.
 * Also increments the session's totalTracks/totalBatches, mirroring what the real
 * AudioScanSchedulerProducerAdapter does downstream in production, since the use case
 * under test relies on that accumulation happening per library.
 */
class FakeScheduleBatchAudioScanUseCase {
  readonly calls: Array<{
    audioFiles: FileInfo[];
    libraryId: MusicLibraryId;
    sessionId: SessionId;
    incremental: boolean;
    force?: boolean;
    skipAiMetadata?: boolean;
  }> = [];

  constructor(private readonly scanSessionRepository: ScanSessionRepository) {}

  async execute(
    audioFiles: FileInfo[],
    libraryId: MusicLibraryId,
    sessionId: SessionId,
    incremental: boolean,
    force?: boolean,
    skipAiMetadata?: boolean,
  ): Promise<{ sessionId: string }> {
    this.calls.push({ audioFiles, libraryId, sessionId, incremental, force, skipAiMetadata });
    await this.scanSessionRepository.incrementSessionTotals(sessionId, {
      totalBatches: Math.ceil(audioFiles.length / 10),
      totalTracks: audioFiles.length,
    });
    return { sessionId };
  }
}

describe('ScheduleTracksByCriteriaScanUseCase', () => {
  let useCase: ScheduleTracksByCriteriaScanUseCase;
  let musicLibraryRepository: MusicLibraryRepository;
  let musicTrackRepository: MusicTrackRepository;
  let prisma: PrismaClient;
  let cleanupDb: () => Promise<void>;
  let fakeScheduleBatch: FakeScheduleBatchAudioScanUseCase;

  beforeAll(async () => {
    const { cleanup } = await setupIntegrationDb();
    cleanupDb = cleanup;

    const logger: ILogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const loggerFactory = { createLogger: vi.fn(() => logger) };

    const dbUrl = process.env.DATABASE_URL ?? 'file:./muzo.db';
    const testPrisma = createIntegrationPrismaClient(dbUrl);
    await testPrisma.$connect();

    fakeScheduleBatch = new FakeScheduleBatchAudioScanUseCase(
      new ScanSessionRepository(testPrisma as any),
    );

    const module = await Test.createTestingModule({
      providers: [
        { provide: PRISMA_SERVICE, useValue: testPrisma },
        { provide: MUSIC_LIBRARY_REPOSITORY, useClass: MusicLibraryRepository },
        { provide: MUSIC_TRACK_REPOSITORY, useClass: MusicTrackRepository },
        { provide: SCAN_SESSION_REPOSITORY, useClass: ScanSessionRepository },
        {
          provide: ScheduleBatchAudioScanUseCase,
          useValue: fakeScheduleBatch as unknown as ScheduleBatchAudioScanUseCase,
        },
        { provide: LOGGER_FACTORY, useValue: loggerFactory },
        { provide: LOGGER, useValue: logger },
        {
          provide: ScheduleTracksByCriteriaScanUseCase,
          useFactory: (
            trackRepo: MusicTrackRepository,
            scanSessionRepo: ScanSessionRepository,
            scheduleBatch: FakeScheduleBatchAudioScanUseCase,
            lf: { createLogger: (name: string) => ILogger },
            log: ILogger,
          ) =>
            new ScheduleTracksByCriteriaScanUseCase(
              trackRepo,
              scanSessionRepo,
              scheduleBatch as unknown as ScheduleBatchAudioScanUseCase,
              lf,
              log,
            ),
          inject: [
            MUSIC_TRACK_REPOSITORY,
            SCAN_SESSION_REPOSITORY,
            ScheduleBatchAudioScanUseCase,
            LOGGER_FACTORY,
            LOGGER,
          ],
        },
      ],
    }).compile();

    await module.init();

    useCase = module.get(ScheduleTracksByCriteriaScanUseCase);
    musicLibraryRepository = module.get(MUSIC_LIBRARY_REPOSITORY);
    musicTrackRepository = module.get(MUSIC_TRACK_REPOSITORY);
    prisma = module.get(PRISMA_SERVICE);
  });

  afterAll(async () => {
    await prisma?.$disconnect?.();
    await cleanupDb?.();
  });

  beforeEach(async () => {
    await prisma.scanSession.deleteMany({});
    await prisma.trackGenre.deleteMany({});
    await prisma.trackSubgenre.deleteMany({});
    await prisma.trackAiAtmosphereTag.deleteMany({});
    await prisma.musicTrack.deleteMany({});
    await prisma.musicLibrary.deleteMany({});
    fakeScheduleBatch.calls.length = 0;
  });

  async function seedTrack(filePath: string, libraryId: MusicLibraryId) {
    return musicTrackRepository.upsertOne({
      filePath,
      libraryId,
      fileName: filePath.split('/').pop()!,
      fileSize: 2048,
      analysisStatus: AudioFileAnalysisStatusEnum.PENDING,
      analysisStartedAt: new Date(),
      duration: 0,
      format: 'mp3',
      fileCreatedAt: new Date(),
      analysisCompletedAt: new Date(),
      analysisError: '',
    });
  }

  describe('execute', () => {
    it('happy path: schedules one call per library, sharing one sessionId, and returns matchedTrackCount', async () => {
      await musicLibraryRepository.save(makeLibrary({ id: 'lib-1' }));
      await musicLibraryRepository.save(makeLibrary({ id: 'lib-2' }));
      await seedTrack('/music/lib1-track1.mp3', LIBRARY_1_ID);
      await seedTrack('/music/lib1-track2.mp3', LIBRARY_1_ID);
      await seedTrack('/music/lib2-track1.mp3', LIBRARY_2_ID);
      // Non-matching: different library, not included in criteria.libraryIds below.
      await musicLibraryRepository.save(makeLibrary({ id: 'lib-3' }));
      await seedTrack('/music/lib3-track1.mp3', models.musicLibrary.id('lib-3') as MusicLibraryId);

      const criteria: FilterCriteria = {
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
        libraryIds: [LIBRARY_1_ID, LIBRARY_2_ID],
        atmosphereIds: null,
      };

      const result = await useCase.execute(criteria, { skipAiMetadata: true, force: true });

      expect(result.matchedTrackCount).toBe(3);
      expect(result.sessionId).toBeDefined();

      // One call per library.
      expect(fakeScheduleBatch.calls).toHaveLength(2);
      const byLibrary = new Map(fakeScheduleBatch.calls.map((c) => [c.libraryId, c]));

      expect(byLibrary.get(LIBRARY_1_ID)?.audioFiles).toHaveLength(2);
      expect(byLibrary.get(LIBRARY_2_ID)?.audioFiles).toHaveLength(1);

      // Same session shared across both calls.
      expect(byLibrary.get(LIBRARY_1_ID)?.sessionId).toEqual(result.sessionId);
      expect(byLibrary.get(LIBRARY_2_ID)?.sessionId).toEqual(result.sessionId);

      // skipAiMetadata/force propagate to every per-library call.
      for (const call of fakeScheduleBatch.calls) {
        expect(call.skipAiMetadata).toBe(true);
        expect(call.force).toBe(true);
      }

      // Session totals reflect the cross-library grand total, not just the last library
      // processed (regression guard for the updateSession overwrite issue).
      const session = await prisma.scanSession.findMany({
        where: { sessionId: extractModelId(result.sessionId).dbId },
      });
      expect(session).toHaveLength(1);
      expect(session[0].totalTracks).toBe(3);
      expect(session[0].totalBatches).toBe(2); // 1 batch per library (each under the 10-file chunk size)
    });

    it('edge case: no tracks match criteria, still creates a session and returns zero count', async () => {
      await musicLibraryRepository.save(makeLibrary({ id: 'lib-1' }));

      const criteria: FilterCriteria = {
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
        libraryIds: [models.musicLibrary.id('nonexistent') as MusicLibraryId],
        atmosphereIds: null,
      };

      const result = await useCase.execute(criteria);

      expect(result.matchedTrackCount).toBe(0);
      expect(result.sessionId).toBeDefined();
      expect(fakeScheduleBatch.calls).toHaveLength(0);
    });

    it('single-library match: schedules exactly one call with default options', async () => {
      await musicLibraryRepository.save(makeLibrary({ id: 'lib-1' }));
      await seedTrack('/music/only-track.mp3', LIBRARY_1_ID);

      const criteria: FilterCriteria = {
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
        libraryIds: [LIBRARY_1_ID],
        atmosphereIds: null,
      };

      const result = await useCase.execute(criteria);

      expect(result.matchedTrackCount).toBe(1);
      expect(fakeScheduleBatch.calls).toHaveLength(1);
      expect(fakeScheduleBatch.calls[0]).toMatchObject({
        libraryId: LIBRARY_1_ID,
        incremental: false,
        force: undefined,
        skipAiMetadata: undefined,
      });
    });
  });
});
