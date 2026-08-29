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
import { ScheduleSingleTrackScanUseCase } from 'src/application/use-cases/job-scheduler/ScheduleSingleTrackScan';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { extractModelId } from 'src/kernel/ids/factory';
import type { MusicLibraryId, MusicTrackId, SessionId } from 'src/kernel/ids';
import { models } from 'src/kernel/types/models';
import { AudioFileAnalysisStatusEnum } from 'src/kernel/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntegrationPrismaClient, setupIntegrationDb } from '../_test-utils/integration-db';
import { makeLibrary } from '../_test-utils/make-library';

const LIBRARY_ID = models.musicLibrary.id('lib-1') as MusicLibraryId;
const TEST_USER_ID = 'test-user-id';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  getCurrentUser: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
}));

/** Fake ScheduleBatchAudioScanUseCase that records calls and returns the given sessionId. */
class FakeScheduleBatchAudioScanUseCase {
  readonly calls: Array<{
    audioFiles: FileInfo[];
    libraryId: MusicLibraryId;
    sessionId: SessionId;
    incremental: boolean;
    force?: boolean;
  }> = [];
  private nextError: Error | null = null;

  setNextError(error: Error) {
    this.nextError = error;
  }

  async execute(
    audioFiles: FileInfo[],
    libraryId: MusicLibraryId,
    sessionId: SessionId,
    incremental: boolean,
    force?: boolean,
  ): Promise<{ sessionId: string }> {
    this.calls.push({
      audioFiles,
      libraryId,
      sessionId,
      incremental,
      force,
    });
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    return { sessionId };
  }
}

describe('ScheduleSingleTrackScanUseCase', () => {
  let useCase: ScheduleSingleTrackScanUseCase;
  let musicLibraryRepository: MusicLibraryRepository;
  let musicTrackRepository: MusicTrackRepository;
  let prisma: PrismaClient;
  let cleanupDb: () => Promise<void>;
  let fakeScheduleBatch: FakeScheduleBatchAudioScanUseCase;

  beforeAll(async () => {
    const { cleanup } = await setupIntegrationDb();
    cleanupDb = cleanup;

    fakeScheduleBatch = new FakeScheduleBatchAudioScanUseCase();

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
          provide: ScheduleSingleTrackScanUseCase,
          useFactory: (
            trackRepo: MusicTrackRepository,
            scanSessionRepo: ScanSessionRepository,
            scheduleBatch: FakeScheduleBatchAudioScanUseCase,
            lf: { createLogger: (name: string) => ILogger },
            log: ILogger,
          ) =>
            new ScheduleSingleTrackScanUseCase(
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

    useCase = module.get(ScheduleSingleTrackScanUseCase);
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

  async function seedTrack(): Promise<MusicTrackId> {
    const library = makeLibrary({ id: 'lib-1' });
    await musicLibraryRepository.save(library);
    const track = await musicTrackRepository.upsertOne({
      filePath: '/music/single-track.mp3',
      libraryId: LIBRARY_ID,
      fileName: 'single-track.mp3',
      fileSize: 2048,
      analysisStatus: AudioFileAnalysisStatusEnum.PENDING,
      analysisStartedAt: new Date(),
      duration: 0,
      format: 'mp3',
      fileCreatedAt: new Date(),
      analysisCompletedAt: new Date(),
      analysisError: '',
    });
    return track.id;
  }

  describe('execute', () => {
    it('happy path: creates session, calls ScheduleBatchAudioScan with single file, libraryId, force false and returns sessionId', async () => {
      const trackId = await seedTrack();

      const result = await useCase.execute(trackId, false);

      expect(result.sessionId).toBeDefined();
      expect(fakeScheduleBatch.calls).toHaveLength(1);
      expect(fakeScheduleBatch.calls[0]).toMatchObject({
        libraryId: LIBRARY_ID,
        incremental: false,
        force: false,
      });
      expect(fakeScheduleBatch.calls[0].audioFiles).toHaveLength(1);
      expect(fakeScheduleBatch.calls[0].audioFiles[0]).toMatchObject({
        filePath: '/music/single-track.mp3',
        fileName: 'single-track.mp3',
        fileSize: 2048,
        extension: '.mp3',
      });
      expect(fakeScheduleBatch.calls[0].sessionId).toEqual(result.sessionId);
      const sessions = await prisma.scanSession.findMany({
        where: { sessionId: extractModelId(result.sessionId).dbId },
      });
      expect(sessions).toHaveLength(1);
    });

    it('happy path: passes force true to ScheduleBatchAudioScan', async () => {
      const trackId = await seedTrack();

      await useCase.execute(trackId, true);

      expect(fakeScheduleBatch.calls).toHaveLength(1);
      expect(fakeScheduleBatch.calls[0]).toMatchObject({
        libraryId: LIBRARY_ID,
        incremental: false,
        force: true,
      });
    });

    it('failure: when track does not exist, propagates error', async () => {
      const missingTrackId = models.musicTrack.id('missing-track') as MusicTrackId;

      await expect(useCase.execute(missingTrackId, false)).rejects.toThrow();
      expect(fakeScheduleBatch.calls).toHaveLength(0);
    });

    it('failure: when ScheduleBatchAudioScan throws, error propagates', async () => {
      const trackId = await seedTrack();
      fakeScheduleBatch.setNextError(new Error('Queue unavailable'));

      await expect(useCase.execute(trackId, false)).rejects.toThrow('Queue unavailable');
      expect(fakeScheduleBatch.calls).toHaveLength(1);
    });
  });
});
