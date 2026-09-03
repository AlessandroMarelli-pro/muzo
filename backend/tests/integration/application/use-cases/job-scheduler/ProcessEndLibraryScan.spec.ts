import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessEndLibraryScanUseCase } from 'src/application/use-cases/job-scheduler/ProcessEndLibraryScan';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { SCAN_PROGRESS_PUBLISHER } from 'src/application/ports/infrastructure/IScanProgressPublisher';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { MUSIC_LIBRARY_REPOSITORY } from 'src/application/ports/repositories/IMusicLibraryRepository';
import { MUSIC_TRACK_REPOSITORY } from 'src/application/ports/repositories/IMusicTrackRepository';
import { SCAN_SESSION_REPOSITORY } from 'src/application/ports/repositories/IScanSessionRepository';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { MusicLibraryRepository } from 'src/adapters/persistence/repositories/music-library/music-library.repository';
import { MusicTrackRepository } from 'src/adapters/persistence/repositories/music-track/music-track.repository';
import { ScanSessionRepository } from 'src/adapters/persistence/repositories/scan-session/scan-session.repository';
import { models } from 'src/kernel/types/models';
import { createIntegrationPrismaClient, setupIntegrationDb } from '../_test-utils/integration-db';
import { makeLibrary } from '../_test-utils/make-library';

const LIBRARY_ID = models.musicLibrary.id('lib-1');
const TEST_USER_ID = 'test-user-id';
const SESSION_ID = models.session.id('session-1');

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
}));

describe('ProcessEndLibraryScanUseCase', () => {
  let useCase: ProcessEndLibraryScanUseCase;
  let musicLibraryRepository: MusicLibraryRepository;
  let prisma: PrismaClient;
  let cleanupDb: () => Promise<void>;
  let fakePublishEvent: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const { cleanup } = await setupIntegrationDb();
    cleanupDb = cleanup;

    fakePublishEvent = vi.fn().mockResolvedValue(undefined);

    const logger: ILogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const loggerFactory = { createLogger: vi.fn(() => logger) };

    const dbUrl = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/muzo';
    const testPrisma = createIntegrationPrismaClient(dbUrl);
    await testPrisma.$connect();

    const module = await Test.createTestingModule({
      providers: [
        { provide: PRISMA_SERVICE, useValue: testPrisma },
        { provide: SCAN_SESSION_REPOSITORY, useClass: ScanSessionRepository },
        { provide: MUSIC_LIBRARY_REPOSITORY, useClass: MusicLibraryRepository },
        { provide: MUSIC_TRACK_REPOSITORY, useClass: MusicTrackRepository },
        {
          provide: SCAN_PROGRESS_PUBLISHER,
          useValue: {
            publishEvent: fakePublishEvent,
            publishError: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: LOGGER_FACTORY, useValue: loggerFactory },
        { provide: LOGGER, useValue: logger },
        {
          provide: ProcessEndLibraryScanUseCase,
          useFactory: (
            scanSessionRepo: ScanSessionRepository,
            publisher: { publishEvent: typeof fakePublishEvent },
            libraryRepo: MusicLibraryRepository,
            trackRepo: MusicTrackRepository,
            lf: { createLogger: (name: string) => ILogger },
            log: ILogger,
          ) =>
            new ProcessEndLibraryScanUseCase(
              scanSessionRepo,
              publisher,
              libraryRepo,
              trackRepo,
              lf,
              log,
            ),
          inject: [
            SCAN_SESSION_REPOSITORY,
            SCAN_PROGRESS_PUBLISHER,
            MUSIC_LIBRARY_REPOSITORY,
            MUSIC_TRACK_REPOSITORY,
            LOGGER_FACTORY,
            LOGGER,
          ],
        },
      ],
    }).compile();

    await module.init();

    useCase = module.get(ProcessEndLibraryScanUseCase);
    musicLibraryRepository = module.get(MUSIC_LIBRARY_REPOSITORY);
    prisma = module.get(PRISMA_SERVICE);
  });

  afterAll(async () => {
    await prisma?.$disconnect?.();
    await cleanupDb?.();
  });

  beforeEach(async () => {
    await prisma.scanSession.deleteMany({});
    await prisma.musicTrack.deleteMany({});
    await prisma.musicLibrary.deleteMany({});
    fakePublishEvent.mockClear();
  });

  async function seedSession(
    overrides: {
      sessionId?: string;
      totalBatches?: number;
      completedBatches?: number;
      totalTracks?: number;
      completedTracks?: number;
      failedTracks?: number;
      overallProgress?: number;
      startedAt?: Date;
    } = {},
  ) {
    const sessionId = overrides.sessionId ?? 'session-1';
    const startedAt = overrides.startedAt ?? new Date();
    await prisma.scanSession.create({
      data: {
        id: sessionId,
        sessionId,
        status: 'SCANNING',
        totalBatches: overrides.totalBatches ?? 1,
        completedBatches: overrides.completedBatches ?? 0,
        totalTracks: overrides.totalTracks ?? 2,
        completedTracks: overrides.completedTracks ?? 0,
        failedTracks: overrides.failedTracks ?? 0,
        overallProgress: overrides.overallProgress ?? 0,
        startedAt,
        createdById: TEST_USER_ID,
      },
    });
    return startedAt;
  }

  describe('execute', () => {
    it('happy path: completes session, publishes scan.complete with session data, and updates library to IDLE', async () => {
      await seedSession({
        totalBatches: 1,
        totalTracks: 2,
        completedTracks: 2,
        failedTracks: 0,
      });
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);

      await useCase.execute(LIBRARY_ID, SESSION_ID, false);

      expect(fakePublishEvent).toHaveBeenCalledTimes(1);
      expect(fakePublishEvent).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({
          type: 'scan.complete',
          libraryId: LIBRARY_ID,
          // 0-100 percentage -- see ScanStateEvent.overallProgress in ScanProgress.types.ts.
          overallProgress: 100,
          data: expect.objectContaining({
            totalBatches: 1,
            totalTracks: 2,
            successful: 2,
            failed: 0,
          }),
        }),
      );
      const libAfter = await musicLibraryRepository.getOneById(LIBRARY_ID);
      expect(libAfter.scanInfo.scanStatus).toBe('IDLE');
    });

    it('publishEvent data: totalBatches, totalTracks, successful, failed, and duration match completed session', async () => {
      const startedAt = new Date(Date.now() - 60_000);
      await seedSession({
        totalBatches: 3,
        totalTracks: 10,
        completedTracks: 8,
        failedTracks: 1,
        startedAt,
      });
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);

      await useCase.execute(LIBRARY_ID, SESSION_ID, false);

      expect(fakePublishEvent).toHaveBeenCalledTimes(1);
      const event = fakePublishEvent.mock.calls[0]![1];
      expect(event.type).toBe('scan.complete');
      expect(event.data.totalBatches).toBe(3);
      expect(event.data.totalTracks).toBe(10);
      expect(event.data.successful).toBe(8);
      expect(event.data.failed).toBe(1);
      expect(event.data.duration).toBeGreaterThanOrEqual(59_000);
      expect(event.data.duration).toBeLessThanOrEqual(61_000);
      expect(event.overallProgress).toBe(100);
    });

    it('when incremental true: updates library with lastIncrementalScanAt (scan still ends IDLE)', async () => {
      await seedSession({
        totalBatches: 1,
        totalTracks: 1,
        completedTracks: 1,
      });
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);

      await useCase.execute(LIBRARY_ID, SESSION_ID, true);

      expect(fakePublishEvent).toHaveBeenCalledTimes(1);
      const libAfter = await musicLibraryRepository.getOneById(LIBRARY_ID);
      expect(libAfter.scanInfo.scanStatus).toBe('IDLE');
      expect(libAfter.scanInfo.lastIncrementalScanAt).toBeDefined();
      expect(libAfter.scanInfo.lastIncrementalScanAt).toBeInstanceOf(Date);
    });

    it('when incremental false: updates library with lastScanAt', async () => {
      await seedSession({
        totalBatches: 1,
        totalTracks: 1,
        completedTracks: 1,
      });
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);

      await useCase.execute(LIBRARY_ID, SESSION_ID, false);

      const libAfter = await musicLibraryRepository.getOneById(LIBRARY_ID);
      expect(libAfter.scanInfo.scanStatus).toBe('IDLE');
      expect(libAfter.scanInfo.lastScanAt).toBeDefined();
      expect(libAfter.scanInfo.lastScanAt).toBeInstanceOf(Date);
    });
  });
});
