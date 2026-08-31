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
import { ScheduleIncompleteTracksScanUseCase } from 'src/application/use-cases/job-scheduler/ScheduleIncompleteTracksScan';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import type { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { AudioFileAnalysisStatusEnum } from 'src/kernel/types';
import { models } from 'src/kernel/types/models';
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

class FakeScheduleBatchAudioScanUseCase {
  readonly calls: Array<{
    audioFiles: FileInfo[];
    libraryId: MusicLibraryId;
    sessionId: SessionId;
    incremental: boolean;
    force?: boolean;
  }> = [];

  async execute(
    audioFiles: FileInfo[],
    libraryId: MusicLibraryId,
    sessionId: SessionId,
    incremental: boolean,
    force?: boolean,
  ): Promise<{ sessionId: string }> {
    this.calls.push({ audioFiles, libraryId, sessionId, incremental, force });
    return { sessionId };
  }
}

describe('ScheduleIncompleteTracksScanUseCase', () => {
  let useCase: ScheduleIncompleteTracksScanUseCase;
  let musicLibraryRepository: MusicLibraryRepository;
  let musicTrackRepository: MusicTrackRepository;
  let prisma: PrismaClient;
  let cleanupDb: () => Promise<void>;
  let fakeScheduleBatch: FakeScheduleBatchAudioScanUseCase;

  beforeAll(async () => {
    const { cleanup } = await setupIntegrationDb();
    cleanupDb = cleanup;

    fakeScheduleBatch = new FakeScheduleBatchAudioScanUseCase();

    const logger: ILogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
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
          provide: ScheduleIncompleteTracksScanUseCase,
          useFactory: (
            trackRepo: MusicTrackRepository,
            scanSessionRepo: ScanSessionRepository,
            scheduleBatch: FakeScheduleBatchAudioScanUseCase,
            lf: { createLogger: (name: string) => ILogger },
            log: ILogger,
          ) =>
            new ScheduleIncompleteTracksScanUseCase(
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

    useCase = module.get(ScheduleIncompleteTracksScanUseCase);
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
    await prisma.musicTrack.deleteMany({});
    await prisma.musicLibrary.deleteMany({});
    fakeScheduleBatch.calls.length = 0;
  });

  async function seedTrack(filePath: string, status: AudioFileAnalysisStatusEnum) {
    return musicTrackRepository.upsertOne({
      filePath,
      libraryId: LIBRARY_ID,
      fileName: filePath.split('/').pop()!,
      fileSize: 2048,
      analysisStatus: status,
      analysisStartedAt: new Date(),
      duration: 0,
      format: 'mp3',
      fileCreatedAt: new Date(),
      analysisCompletedAt: new Date(),
      analysisError: '',
    });
  }

  it('schedules only the tracks whose analysisStatus is not COMPLETED, with force true', async () => {
    await musicLibraryRepository.save(makeLibrary({ id: 'lib-1' }));
    await seedTrack('/music/done.mp3', AudioFileAnalysisStatusEnum.COMPLETED);
    await seedTrack('/music/failed.mp3', AudioFileAnalysisStatusEnum.FAILED);
    await seedTrack('/music/pending.mp3', AudioFileAnalysisStatusEnum.PENDING);

    const result = await useCase.execute(LIBRARY_ID);

    expect(result.scheduledTrackCount).toBe(2);
    expect(fakeScheduleBatch.calls).toHaveLength(1);
    expect(fakeScheduleBatch.calls[0]).toMatchObject({ libraryId: LIBRARY_ID, force: true });
    const scheduledPaths = fakeScheduleBatch.calls[0].audioFiles.map((f) => f.filePath).sort();
    expect(scheduledPaths).toEqual(['/music/failed.mp3', '/music/pending.mp3']);
  });

  it('completes the session and schedules nothing when every track is COMPLETED', async () => {
    await musicLibraryRepository.save(makeLibrary({ id: 'lib-1' }));
    await seedTrack('/music/done.mp3', AudioFileAnalysisStatusEnum.COMPLETED);

    const result = await useCase.execute(LIBRARY_ID);

    expect(result.scheduledTrackCount).toBe(0);
    expect(fakeScheduleBatch.calls).toHaveLength(0);
    const sessions = await prisma.scanSession.findMany({});
    expect(sessions).toHaveLength(1);
    expect(sessions[0].completedAt).not.toBeNull();
  });

  it('reuses an already-active session without scheduling a second scan', async () => {
    await musicLibraryRepository.save(makeLibrary({ id: 'lib-1' }));
    await seedTrack('/music/failed.mp3', AudioFileAnalysisStatusEnum.FAILED);

    const first = await useCase.execute(LIBRARY_ID);
    fakeScheduleBatch.calls.length = 0;
    const second = await useCase.execute(LIBRARY_ID);

    expect(second.reused).toBe(true);
    expect(second.sessionId).toEqual(first.sessionId);
    expect(fakeScheduleBatch.calls).toHaveLength(0);
  });
});
