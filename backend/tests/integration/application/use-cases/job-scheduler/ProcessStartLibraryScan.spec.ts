import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { MusicLibraryRepository } from 'src/adapters/persistence/repositories/music-library/music-library.repository';
import { ScanSessionRepository } from 'src/adapters/persistence/repositories/scan-session/scan-session.repository';
import { FILE_MANAGER } from 'src/application/ports/infrastructure/IFileManager';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import type { IScanProgressPublisher } from 'src/application/ports/infrastructure/IScanProgressPublisher';
import { SCAN_PROGRESS_PUBLISHER } from 'src/application/ports/infrastructure/IScanProgressPublisher';
import type { IMusicLibraryRepository } from 'src/application/ports/repositories/IMusicLibraryRepository';
import { MUSIC_LIBRARY_REPOSITORY } from 'src/application/ports/repositories/IMusicLibraryRepository';
import { SCAN_SESSION_REPOSITORY } from 'src/application/ports/repositories/IScanSessionRepository';
import { ProcessStartLibraryScanUseCase } from 'src/application/use-cases/job-scheduler/ProcessStartLibraryScan';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { FileManager } from 'src/infrastructure/filesystem/file.manager';
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
import { setupIntegrationDb } from '../_test-utils/integration-db';
import { makeLibrary } from '../_test-utils/make-library';

const LIBRARY_ID = models.musicLibrary.id('lib-1');
const SESSION_ID = models.session.id('session-1');
const TEST_USER_ID = 'test-user-id';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
}));

describe('ProcessStartLibraryScanUseCase', () => {
  let useCase: ProcessStartLibraryScanUseCase;
  let musicLibraryRepository: IMusicLibraryRepository;
  let scanSessionRepository: ScanSessionRepository;
  let prisma: PrismaClient;
  let cleanupDb: () => Promise<void>;
  let tempDirWithFiles: string;
  let tempDirEmpty: string;
  let fakePublishEvent: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const { cleanup } = await setupIntegrationDb();
    cleanupDb = cleanup;

    tempDirWithFiles = path.join(os.tmpdir(), `muzo-scan-${Date.now()}-with`);
    tempDirEmpty = path.join(os.tmpdir(), `muzo-scan-${Date.now()}-empty`);
    await fs.mkdir(tempDirWithFiles, { recursive: true });
    await fs.mkdir(tempDirEmpty, { recursive: true });
    await fs.writeFile(path.join(tempDirWithFiles, 'a.mp3'), '');
    await fs.writeFile(path.join(tempDirWithFiles, 'b.flac'), '');

    const logger: ILogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const loggerFactory = { createLogger: vi.fn(() => logger) };
    fakePublishEvent = vi.fn().mockResolvedValue(undefined);

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
        { provide: FILE_MANAGER, useClass: FileManager },
        { provide: LOGGER_FACTORY, useValue: loggerFactory },
        { provide: LOGGER, useValue: logger },
        {
          provide: SCAN_PROGRESS_PUBLISHER,
          useValue: {
            publishEvent: fakePublishEvent,
            publishError: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ProcessStartLibraryScanUseCase,
          useFactory: (
            fileManager: FileManager,
            repo: IMusicLibraryRepository,
            lf: { createLogger: (name: string) => ILogger },
            log: ILogger,
            publisher: IScanProgressPublisher,
            scanSessionRepo: ScanSessionRepository,
          ) =>
            new ProcessStartLibraryScanUseCase(
              fileManager,
              repo,
              lf,
              log,
              publisher,
              scanSessionRepo,
            ),
          inject: [
            FILE_MANAGER,
            MUSIC_LIBRARY_REPOSITORY,
            LOGGER_FACTORY,
            LOGGER,
            SCAN_PROGRESS_PUBLISHER,
            SCAN_SESSION_REPOSITORY,
          ],
        },
      ],
    }).compile();

    await module.init();

    useCase = module.get(ProcessStartLibraryScanUseCase);
    musicLibraryRepository = module.get(MUSIC_LIBRARY_REPOSITORY);
    scanSessionRepository = module.get(SCAN_SESSION_REPOSITORY);
    prisma = module.get(PRISMA_SERVICE);
  });

  afterAll(async () => {
    await prisma?.$disconnect?.();
    await cleanupDb?.();
    await fs
      .rm(tempDirWithFiles, { recursive: true, force: true })
      .catch(() => {});
    await fs.rm(tempDirEmpty, { recursive: true, force: true }).catch(() => {});
  });

  beforeEach(async () => {
    await prisma.scanSession.deleteMany({});
    await prisma.musicLibrary.deleteMany({});
    fakePublishEvent?.mockClear?.();
  });

  describe('execute', () => {
    it('happy path: returns audio files when library exists and directory contains supported files', async () => {
      const library = makeLibrary({ id: 'lib-1', rootPath: tempDirWithFiles });
      await (musicLibraryRepository as MusicLibraryRepository).save(library);

      const result = await useCase.execute(LIBRARY_ID, false, SESSION_ID);

      expect(result).toHaveLength(2);
      expect(result.map((f) => f.fileName).sort()).toEqual(['a.mp3', 'b.flac']);
      expect(result.every((f) => f.filePath.startsWith(tempDirWithFiles))).toBe(
        true,
      );
      const libAfter = await musicLibraryRepository.getOneById(LIBRARY_ID);
      expect(libAfter.scanInfo.scanStatus).toBe('IDLE');
    });

    it('edge case: when no audio files found, updates scan status to IDLE, publishes scan.complete, and returns []', async () => {
      const library = makeLibrary({ id: 'lib-1', rootPath: tempDirEmpty });
      await (musicLibraryRepository as MusicLibraryRepository).save(library);
      const session = await scanSessionRepository.createSession(SESSION_ID);

      const result = await useCase.execute(LIBRARY_ID, false, session.id);

      expect(result).toEqual([]);
      const libAfter = await musicLibraryRepository.getOneById(LIBRARY_ID);
      expect(libAfter.scanInfo.scanStatus).toBe('IDLE');
      expect(fakePublishEvent).toHaveBeenCalledTimes(1);
      expect(fakePublishEvent).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({
          type: 'scan.complete',
          sessionId: LIBRARY_ID,
          libraryId: LIBRARY_ID,
          data: expect.objectContaining({
            totalBatches: session.totalBatches,
            totalTracks: session.totalTracks,
            successful: session.completedTracks,
            failed: session.failedTracks,
          }),
          overallProgress: 10000,
        }),
      );
    });

    it('edge case: when no audio files found and session does not exist, returns [] without publishing', async () => {
      const library = makeLibrary({ id: 'lib-1', rootPath: tempDirEmpty });
      await (musicLibraryRepository as MusicLibraryRepository).save(library);

      const result = await useCase.execute(LIBRARY_ID, false, SESSION_ID);

      expect(result).toEqual([]);
      const libAfter = await musicLibraryRepository.getOneById(LIBRARY_ID);
      expect(libAfter.scanInfo.scanStatus).toBe('IDLE');
      expect(fakePublishEvent).not.toHaveBeenCalled();
    });

    it('failure: propagates when library does not exist', async () => {
      await expect(
        useCase.execute(LIBRARY_ID, false, SESSION_ID),
      ).rejects.toMatchObject({
        message: expect.stringContaining('not found'),
      });
    });
  });
});
