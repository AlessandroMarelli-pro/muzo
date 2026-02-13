import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { MusicLibraryRepository } from 'src/adapters/persistence/repositories/music-library/music-library.repository';
import { ScanSessionRepository } from 'src/adapters/persistence/repositories/scan-session/scan-session.repository';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import type { ILibraryScanSchedulerProducer } from 'src/application/ports/infrastructure/ILibraryScanSchedulerProducer';
import { LIBRARY_SCAN_SCHEDULER_PRODUCER } from 'src/application/ports/infrastructure/ILibraryScanSchedulerProducer';
import { MUSIC_LIBRARY_REPOSITORY } from 'src/application/ports/repositories/IMusicLibraryRepository';
import { SCAN_SESSION_REPOSITORY } from 'src/application/ports/repositories/IScanSessionRepository';
import { ScheduleLibraryScanUseCase } from 'src/application/use-cases/job-scheduler/ScheduleLibraryScan';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { extractModelId } from 'src/kernel/ids/factory';
import type { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { models } from 'src/kernel/types/models';
import type { ActionContext } from 'src/kernel/types/model-types';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { setupIntegrationDb } from '../_test-utils/integration-db';
import { makeLibrary } from '../_test-utils/make-library';

const LIBRARY_ID = models.musicLibrary.id('lib-1');
const TEST_USER_ID = 'test-user-id';

const mockUser = { id: `User:${TEST_USER_ID}` };
vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  getCurrentUser: vi.fn(() => mockUser),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => mockUser),
}));

/** Fake producer that records calls and resolves; can be set to throw once. */
class FakeLibraryScanSchedulerProducer implements ILibraryScanSchedulerProducer {
  readonly scheduleLibraryScanCalls: Array<{
    libraryId: MusicLibraryId;
    incremental: boolean;
    contextUser: ActionContext['user'];
    sessionId: SessionId;
  }> = [];
  private nextError: Error | null = null;

  setNextError(error: Error) {
    this.nextError = error;
  }

  async scheduleLibraryScan(
    libraryId: MusicLibraryId,
    incremental: boolean,
    contextUser: ActionContext['user'],
    sessionId: SessionId,
  ): Promise<{ sessionId: SessionId }> {
    this.scheduleLibraryScanCalls.push({
      libraryId,
      incremental,
      contextUser,
      sessionId,
    });
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    return { sessionId };
  }

  async scheduleEndLibraryScan(): Promise<{ sessionId: SessionId }> {
    throw new Error('Not used in ScheduleLibraryScan');
  }
}

describe('ScheduleLibraryScanUseCase', () => {
  let useCase: ScheduleLibraryScanUseCase;
  let musicLibraryRepository: MusicLibraryRepository;
  let prisma: PrismaClient;
  let cleanupDb: () => Promise<void>;
  let fakeProducer: FakeLibraryScanSchedulerProducer;

  beforeAll(async () => {
    const { cleanup } = await setupIntegrationDb();
    cleanupDb = cleanup;

    fakeProducer = new FakeLibraryScanSchedulerProducer();

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
        { provide: MUSIC_LIBRARY_REPOSITORY, useClass: MusicLibraryRepository },
        { provide: SCAN_SESSION_REPOSITORY, useClass: ScanSessionRepository },
        {
          provide: LIBRARY_SCAN_SCHEDULER_PRODUCER,
          useValue: fakeProducer as ILibraryScanSchedulerProducer,
        },
        { provide: LOGGER_FACTORY, useValue: loggerFactory },
        { provide: LOGGER, useValue: logger },
        {
          provide: ScheduleLibraryScanUseCase,
          useFactory: (
            producer: ILibraryScanSchedulerProducer,
            libraryRepo: MusicLibraryRepository,
            scanSessionRepo: ScanSessionRepository,
            lf: { createLogger: (name: string) => ILogger },
            log: ILogger,
          ) =>
            new ScheduleLibraryScanUseCase(
              producer,
              libraryRepo,
              scanSessionRepo,
              lf,
              log,
            ),
          inject: [
            LIBRARY_SCAN_SCHEDULER_PRODUCER,
            MUSIC_LIBRARY_REPOSITORY,
            SCAN_SESSION_REPOSITORY,
            LOGGER_FACTORY,
            LOGGER,
          ],
        },
      ],
    }).compile();

    await module.init();

    useCase = module.get(ScheduleLibraryScanUseCase);
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
    fakeProducer.scheduleLibraryScanCalls.length = 0;
  });

  describe('execute', () => {
    it('happy path: creates session, calls producer, updates library status to SCANNING and returns sessionId', async () => {
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);

      const result = await useCase.execute(LIBRARY_ID, false);

      expect(result.sessionId).toBeDefined();
      expect(fakeProducer.scheduleLibraryScanCalls).toHaveLength(1);
      expect(fakeProducer.scheduleLibraryScanCalls[0]).toMatchObject({
        libraryId: LIBRARY_ID,
        incremental: false,
        contextUser: { id: `User:${TEST_USER_ID}` },
      });
      expect(fakeProducer.scheduleLibraryScanCalls[0].sessionId).toEqual(
        result.sessionId,
      );
      const libAfter = await musicLibraryRepository.getOneById(LIBRARY_ID);
      expect(libAfter.scanInfo.scanStatus).toBe('SCANNING');
      const sessions = await prisma.scanSession.findMany({
        where: { sessionId: extractModelId(result.sessionId).dbId },
      });
      expect(sessions).toHaveLength(1);
    });

    it('happy path: passes incremental true to producer', async () => {
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);

      await useCase.execute(LIBRARY_ID, true);

      expect(fakeProducer.scheduleLibraryScanCalls[0]).toMatchObject({
        libraryId: LIBRARY_ID,
        incremental: true,
        contextUser: { id: `User:${TEST_USER_ID}` },
      });
    });

    it('failure: when producer throws, updates library to IDLE, deletes session and propagates error', async () => {
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);
      fakeProducer.setNextError(new Error('Queue unavailable'));

      await expect(useCase.execute(LIBRARY_ID, false)).rejects.toThrow(
        'Queue unavailable',
      );

      const libAfter = await musicLibraryRepository.getOneById(LIBRARY_ID);
      expect(libAfter.scanInfo.scanStatus).toBe('IDLE');
      expect(await prisma.scanSession.count()).toBe(0);
    });

    it('failure: propagates when library does not exist (updateScanStatus after producer fails or library missing)', async () => {
      await expect(useCase.execute(LIBRARY_ID, false)).rejects.toThrow();
    });
  });
});
