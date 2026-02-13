import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { StopLibraryScanUseCase } from 'src/application/use-cases/job-scheduler/StopLibraryScan';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { MUSIC_LIBRARY_REPOSITORY } from 'src/application/ports/repositories/IMusicLibraryRepository';
import { SCAN_SESSION_REPOSITORY } from 'src/application/ports/repositories/IScanSessionRepository';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { MusicLibraryRepository } from 'src/adapters/persistence/repositories/music-library/music-library.repository';
import { ScanSessionRepository } from 'src/adapters/persistence/repositories/scan-session/scan-session.repository';
import { models } from 'src/kernel/types/models';
import { setupIntegrationDb } from '../_test-utils/integration-db';
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

describe('StopLibraryScanUseCase', () => {
  let useCase: StopLibraryScanUseCase;
  let musicLibraryRepository: MusicLibraryRepository;
  let prisma: PrismaClient;
  let cleanupDb: () => Promise<void>;

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
    const testPrisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    });
    await testPrisma.$connect();

    const module = await Test.createTestingModule({
      providers: [
        { provide: PRISMA_SERVICE, useValue: testPrisma },
        { provide: SCAN_SESSION_REPOSITORY, useClass: ScanSessionRepository },
        { provide: MUSIC_LIBRARY_REPOSITORY, useClass: MusicLibraryRepository },
        { provide: LOGGER_FACTORY, useValue: loggerFactory },
        { provide: LOGGER, useValue: logger },
        {
          provide: StopLibraryScanUseCase,
          useFactory: (
            libraryRepo: MusicLibraryRepository,
            scanSessionRepo: ScanSessionRepository,
            lf: { createLogger: (name: string) => ILogger },
            log: ILogger,
          ) =>
            new StopLibraryScanUseCase(
              libraryRepo,
              scanSessionRepo,
              lf,
              log,
            ),
          inject: [
            MUSIC_LIBRARY_REPOSITORY,
            SCAN_SESSION_REPOSITORY,
            LOGGER_FACTORY,
            LOGGER,
          ],
        },
      ],
    }).compile();

    await module.init();

    useCase = module.get(StopLibraryScanUseCase);
    musicLibraryRepository = module.get(MUSIC_LIBRARY_REPOSITORY);
    prisma = module.get(PRISMA_SERVICE);
  });

  afterAll(async () => {
    await prisma?.$disconnect?.();
    await cleanupDb?.();
  });

  beforeEach(async () => {
    await prisma.scanSession.deleteMany({});
    await prisma.musicLibrary.deleteMany({});
  });

  async function seedSession(sessionId = 'session-1') {
    await prisma.scanSession.create({
      data: {
        id: sessionId,
        sessionId,
        status: 'SCANNING',
        totalBatches: 1,
        completedBatches: 0,
        totalTracks: 2,
        completedTracks: 0,
        failedTracks: 0,
        overallProgress: 0,
        startedAt: new Date(),
        createdById: TEST_USER_ID,
      },
    });
  }

  describe('execute', () => {
    it('happy path: sets library scan status to IDLE and deletes session, returns true', async () => {
      const library = makeLibrary({
        id: 'lib-1',
        scanInfo: {
          lastScanAt: null,
          lastIncrementalScanAt: null,
          scanStatus: 'SCANNING',
        },
      });
      await musicLibraryRepository.save(library);
      await seedSession();

      const result = await useCase.execute(LIBRARY_ID, SESSION_ID);

      expect(result).toBe(true);
      const libAfter = await musicLibraryRepository.getOneById(LIBRARY_ID);
      expect(libAfter.scanInfo.scanStatus).toBe('IDLE');
      const sessionCount = await prisma.scanSession.count({
        where: { sessionId: 'session-1', createdById: TEST_USER_ID },
      });
      expect(sessionCount).toBe(0);
    });

    it('when library does not exist: updateScanStatus throws', async () => {
      await seedSession();

      await expect(
        useCase.execute(LIBRARY_ID, SESSION_ID),
      ).rejects.toThrow();
    });

    it('when session does not exist: deleteSession throws', async () => {
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);
      // no session seeded

      await expect(
        useCase.execute(LIBRARY_ID, SESSION_ID),
      ).rejects.toThrow();
    });
  });
});
