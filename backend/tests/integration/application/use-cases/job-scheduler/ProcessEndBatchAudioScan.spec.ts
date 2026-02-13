import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { ScanSessionRepository } from 'src/adapters/persistence/repositories/scan-session/scan-session.repository';
import type {
  AudioFile,
  AudioScanBatchJobData,
} from 'src/application/ports/dtos/JobSchedulersData';
import { LIBRARY_SCAN_SCHEDULER_PRODUCER } from 'src/application/ports/infrastructure/ILibraryScanSchedulerProducer';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { SCAN_PROGRESS_PUBLISHER } from 'src/application/ports/infrastructure/IScanProgressPublisher';
import { SCAN_SESSION_REPOSITORY } from 'src/application/ports/repositories/IScanSessionRepository';
import { ProcessEndBatchAudioScanUseCase } from 'src/application/use-cases/job-scheduler/ProcessEndBatchAudioScan';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { models } from 'src/kernel/types/models';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { makeContextUser } from '../../../../_test-utils/make-context-user';
import { setupIntegrationDb } from '../_test-utils/integration-db';

const LIBRARY_ID = models.musicLibrary.id('lib-1');
const TEST_USER_ID = 'test-user-id';
const SESSION_ID = models.session.id('session-1');

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
}));

const contextUser = makeContextUser(TEST_USER_ID);

function makeBatchData(
  overrides: Partial<AudioScanBatchJobData> = {},
): AudioScanBatchJobData {
  return {
    audioFiles: [
      {
        filePath: '/music/a.mp3',
        fileName: 'a.mp3',
        fileSize: 100,
        extension: '.mp3',
        lastModified: new Date(),
        trackIndex: 0,
        libraryId: LIBRARY_ID,
      },
      {
        filePath: '/music/b.mp3',
        fileName: 'b.mp3',
        fileSize: 200,
        extension: '.mp3',
        lastModified: new Date(),
        trackIndex: 1,
        libraryId: LIBRARY_ID,
      },
    ],
    sessionId: SESSION_ID,
    contextUser,
    startDateTS: Date.now(),
    totalFiles: 2,
    totalBatches: 1,
    batchIndex: 0,
    libraryId: LIBRARY_ID,
    incremental: false,
    ...overrides,
  };
}

describe('ProcessEndBatchAudioScanUseCase', () => {
  let useCase: ProcessEndBatchAudioScanUseCase;
  let prisma: PrismaClient;
  let cleanupDb: () => Promise<void>;
  let fakePublishEvent: ReturnType<typeof vi.fn>;
  let fakePublishError: ReturnType<typeof vi.fn>;
  let fakeScheduleEndLibraryScan: ReturnType<typeof vi.fn>;
  let fakeScheduleLibraryScan: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const { cleanup } = await setupIntegrationDb();
    cleanupDb = cleanup;

    fakePublishEvent = vi.fn().mockResolvedValue(undefined);
    fakePublishError = vi.fn().mockResolvedValue(undefined);
    fakeScheduleEndLibraryScan = vi.fn().mockResolvedValue(undefined);
    fakeScheduleLibraryScan = vi.fn().mockResolvedValue(undefined);

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
        {
          provide: SCAN_PROGRESS_PUBLISHER,
          useValue: {
            publishEvent: fakePublishEvent,
            publishError: fakePublishError,
          },
        },
        {
          provide: LIBRARY_SCAN_SCHEDULER_PRODUCER,
          useValue: {
            scheduleEndLibraryScan: fakeScheduleEndLibraryScan,
            scheduleLibraryScan: fakeScheduleLibraryScan,
          },
        },
        { provide: LOGGER_FACTORY, useValue: loggerFactory },
        { provide: LOGGER, useValue: logger },
        {
          provide: ProcessEndBatchAudioScanUseCase,
          useFactory: (
            scanSessionRepo: ScanSessionRepository,
            publisher: {
              publishEvent: typeof fakePublishEvent;
              publishError: typeof fakePublishError;
            },
            producer: {
              scheduleEndLibraryScan: typeof fakeScheduleEndLibraryScan;
              scheduleLibraryScan: typeof fakeScheduleLibraryScan;
            },
            lf: { createLogger: (name: string) => ILogger },
            log: ILogger,
          ) =>
            new ProcessEndBatchAudioScanUseCase(
              scanSessionRepo,
              publisher,
              producer,
              lf,
              log,
            ),
          inject: [
            SCAN_SESSION_REPOSITORY,
            SCAN_PROGRESS_PUBLISHER,
            LIBRARY_SCAN_SCHEDULER_PRODUCER,
            LOGGER_FACTORY,
            LOGGER,
          ],
        },
      ],
    }).compile();

    await module.init();

    useCase = module.get(ProcessEndBatchAudioScanUseCase);
    prisma = module.get(PRISMA_SERVICE);
  });

  afterAll(async () => {
    await prisma?.$disconnect?.();
    await cleanupDb?.();
  });

  beforeEach(async () => {
    await prisma.scanSession.deleteMany({});
    fakePublishEvent.mockClear();
    fakeScheduleEndLibraryScan.mockClear();
  });

  async function seedSession(
    overrides: {
      sessionId?: string;
      totalBatches?: number;
      completedBatches?: number;
      totalTracks?: number;
      completedTracks?: number;
      overallProgress?: number;
    } = {},
  ) {
    const sessionId = overrides.sessionId ?? 'session-1';
    await prisma.scanSession.create({
      data: {
        id: sessionId,
        sessionId,
        status: 'SCANNING',
        totalBatches: overrides.totalBatches ?? 1,
        completedBatches: overrides.completedBatches ?? 0,
        totalTracks: overrides.totalTracks ?? 2,
        completedTracks: overrides.completedTracks ?? 0,
        failedTracks: 0,
        overallProgress: overrides.overallProgress ?? 0,
        startedAt: new Date(),
        createdById: TEST_USER_ID,
      },
    });
  }

  describe('execute', () => {
    it('happy path: updates session progress and publishes batch.complete with correct data', async () => {
      await seedSession({ totalBatches: 1, totalTracks: 2 });
      const data = makeBatchData({
        audioFiles: [
          {
            filePath: '/music/a.mp3',
            fileName: 'a.mp3',
            fileSize: 100,
            extension: '.mp3',
            lastModified: new Date(),
            trackIndex: 0,
            libraryId: LIBRARY_ID,
          },
          {
            filePath: '/music/b.mp3',
            fileName: 'b.mp3',
            fileSize: 200,
            extension: '.mp3',
            lastModified: new Date(),
            trackIndex: 1,
            libraryId: LIBRARY_ID,
          },
        ],
        totalFiles: 2,
        totalBatches: 1,
        batchIndex: 0,
      });

      await useCase.execute(data, LIBRARY_ID, false, contextUser);

      expect(fakePublishEvent).toHaveBeenCalledTimes(1);
      expect(fakePublishEvent).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({
          type: 'batch.complete',
          sessionId: SESSION_ID,
          libraryId: LIBRARY_ID,
          batchIndex: 0,
          data: {
            successful: 2,
            failed: 0,
            totalTracks: 2,
          },
        }),
      );
      expect(fakeScheduleEndLibraryScan).toHaveBeenCalledTimes(1);
      expect(fakeScheduleEndLibraryScan).toHaveBeenCalledWith(
        LIBRARY_ID,
        SESSION_ID,
        contextUser,
        false,
      );
    });

    it('when session does not exist or not SCANNING: does not publish and does not schedule', async () => {
      const data = makeBatchData();
      await useCase.execute(data, LIBRARY_ID, false, contextUser);

      expect(fakePublishEvent).not.toHaveBeenCalled();
      expect(fakeScheduleEndLibraryScan).not.toHaveBeenCalled();
    });

    it('multiple batches: publishEvent receives correct batchIndex and data per batch; scheduleEndLibraryScan only when complete', async () => {
      await seedSession({ totalBatches: 2, totalTracks: 4 });
      const batch0Files: AudioFile[] = [
        {
          filePath: '/music/a.mp3',
          fileName: 'a.mp3',
          fileSize: 100,
          extension: '.mp3',
          lastModified: new Date(),
          trackIndex: 0,
          libraryId: LIBRARY_ID,
        },
        {
          filePath: '/music/b.mp3',
          fileName: 'b.mp3',
          fileSize: 200,
          extension: '.mp3',
          lastModified: new Date(),
          trackIndex: 1,
          libraryId: LIBRARY_ID,
        },
      ];
      const batch1Files: AudioFile[] = [
        {
          filePath: '/music/c.mp3',
          fileName: 'c.mp3',
          fileSize: 300,
          extension: '.mp3',
          lastModified: new Date(),
          trackIndex: 2,
          libraryId: LIBRARY_ID,
        },
        {
          filePath: '/music/d.mp3',
          fileName: 'd.mp3',
          fileSize: 400,
          extension: '.mp3',
          lastModified: new Date(),
          trackIndex: 3,
          libraryId: LIBRARY_ID,
        },
      ];

      await useCase.execute(
        makeBatchData({
          audioFiles: batch0Files,
          totalFiles: 4,
          totalBatches: 2,
          batchIndex: 0,
        }),
        LIBRARY_ID,
        true,
        contextUser,
      );

      expect(fakePublishEvent).toHaveBeenCalledTimes(1);
      expect(fakePublishEvent).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({
          type: 'batch.complete',
          batchIndex: 0,
          data: {
            successful: 4,
            failed: 0,
            totalTracks: 4,
          },
        }),
      );
      expect(fakeScheduleEndLibraryScan).not.toHaveBeenCalled();

      await useCase.execute(
        makeBatchData({
          audioFiles: batch1Files,
          totalFiles: 4,
          totalBatches: 2,
          batchIndex: 1,
        }),
        LIBRARY_ID,
        true,
        contextUser,
      );

      expect(fakePublishEvent).toHaveBeenCalledTimes(2);
      expect(fakePublishEvent).toHaveBeenNthCalledWith(
        2,
        SESSION_ID,
        expect.objectContaining({
          type: 'batch.complete',
          batchIndex: 1,
          data: {
            successful: 4,
            failed: 0,
            totalTracks: 4,
          },
        }),
      );
      expect(fakeScheduleEndLibraryScan).toHaveBeenCalledTimes(1);
      expect(fakeScheduleEndLibraryScan).toHaveBeenCalledWith(
        LIBRARY_ID,
        SESSION_ID,
        contextUser,
        true,
      );
    });
  });
});
