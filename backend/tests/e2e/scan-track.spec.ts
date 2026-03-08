/**
 * E2E test: scanTrack feature (ScheduleSingleTrackScanUseCase with real persistence and faked producer).
 * Exercises the full path from use case to repos; no HTTP or Redis.
 */
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { MusicLibraryRepository } from 'src/adapters/persistence/repositories/music-library/music-library.repository';
import { MusicTrackRepository } from 'src/adapters/persistence/repositories/music-track/music-track.repository';
import { ScanSessionRepository } from 'src/adapters/persistence/repositories/scan-session/scan-session.repository';
import { AUDIO_SCAN_SCHEDULER_PRODUCER } from 'src/application/ports/infrastructure/IAudioScanSchedulerProducer';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { MUSIC_LIBRARY_REPOSITORY } from 'src/application/ports/repositories/IMusicLibraryRepository';
import { MUSIC_TRACK_REPOSITORY } from 'src/application/ports/repositories/IMusicTrackRepository';
import { SCAN_SESSION_REPOSITORY } from 'src/application/ports/repositories/IScanSessionRepository';
import {
  ScheduleBatchAudioScanUseCase,
  ScheduleSingleTrackScanUseCase,
} from 'src/application/use-cases';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { AudioFileAnalysisStatusEnum } from 'src/kernel/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIntegrationPrismaClient,
  setupIntegrationDb,
} from '../integration/application/use-cases/_test-utils/integration-db';
import { makeLibrary } from '../integration/application/use-cases/_test-utils/make-library';

const TEST_USER_ID = 'test-user-id';

const logger: ILogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};
const loggerFactory = { createLogger: vi.fn(() => logger) };

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  getCurrentUser: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
}));

const fakeProducer = {
  scheduleBatchAudioScan: vi.fn().mockResolvedValue({ sessionId: 'session-fake' }),
};

describe('scanTrack (e2e)', () => {
  let useCase: ScheduleSingleTrackScanUseCase;
  let musicLibraryRepository: MusicLibraryRepository;
  let musicTrackRepository: MusicTrackRepository;
  let prisma: PrismaClient;
  let cleanupDb: () => Promise<void>;
  let trackId: string;

  beforeAll(async () => {
    const { cleanup } = await setupIntegrationDb();
    cleanupDb = cleanup;

    const dbUrl = process.env.DATABASE_URL!;
    const testPrisma = createIntegrationPrismaClient(dbUrl);
    await testPrisma.$connect();

    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: PRISMA_SERVICE, useValue: testPrisma },
        { provide: MUSIC_LIBRARY_REPOSITORY, useClass: MusicLibraryRepository },
        { provide: MUSIC_TRACK_REPOSITORY, useClass: MusicTrackRepository },
        { provide: SCAN_SESSION_REPOSITORY, useClass: ScanSessionRepository },
        { provide: AUDIO_SCAN_SCHEDULER_PRODUCER, useValue: fakeProducer },
        { provide: LOGGER_FACTORY, useValue: loggerFactory },
        { provide: LOGGER, useValue: logger },
        {
          provide: ScheduleBatchAudioScanUseCase,
          useFactory: (producer: typeof fakeProducer, lf: typeof loggerFactory, log: ILogger) =>
            new ScheduleBatchAudioScanUseCase(producer as any, lf, log),
          inject: [AUDIO_SCAN_SCHEDULER_PRODUCER, LOGGER_FACTORY, LOGGER],
        },
        {
          provide: ScheduleSingleTrackScanUseCase,
          useFactory: (
            trackRepo: MusicTrackRepository,
            scanSessionRepo: ScanSessionRepository,
            scheduleBatch: ScheduleBatchAudioScanUseCase,
            lf: typeof loggerFactory,
            log: ILogger,
          ) =>
            new ScheduleSingleTrackScanUseCase(trackRepo, scanSessionRepo, scheduleBatch, lf, log),
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

    await moduleRef.init();

    useCase = moduleRef.get(ScheduleSingleTrackScanUseCase);
    musicLibraryRepository = moduleRef.get(MUSIC_LIBRARY_REPOSITORY);
    musicTrackRepository = moduleRef.get(MUSIC_TRACK_REPOSITORY);
    prisma = moduleRef.get(PRISMA_SERVICE);

    const library = makeLibrary({ id: 'lib-1' });
    await musicLibraryRepository.save(library);
    const track = await musicTrackRepository.upsertOne({
      filePath: '/music/e2e-track.mp3',
      libraryId: library.id,
      fileName: 'e2e-track.mp3',
      fileSize: 1024,
      analysisStatus: AudioFileAnalysisStatusEnum.PENDING,
      analysisStartedAt: new Date(),
      duration: 0,
      format: 'mp3',
      fileCreatedAt: new Date(),
      analysisCompletedAt: new Date(),
      analysisError: '',
    });
    trackId = track.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect?.();
    await cleanupDb?.();
  });

  beforeEach(async () => {
    await prisma.scanSession.deleteMany({});
    fakeProducer.scheduleBatchAudioScan.mockClear();
  });

  it('returns sessionId when execute is called with trackId and force false', async () => {
    const { sessionId } = await useCase.execute(trackId as any, false);

    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
    expect(fakeProducer.scheduleBatchAudioScan).toHaveBeenCalledTimes(1);
  });

  it('accepts force true and passes it to ScheduleBatchAudioScan', async () => {
    await useCase.execute(trackId as any, true);

    expect(fakeProducer.scheduleBatchAudioScan).toHaveBeenCalledTimes(1);
    const args = fakeProducer.scheduleBatchAudioScan.mock.calls[0];
    expect(args[5]).toBe(true);
  });

  it('returns error when trackId is invalid or track does not exist', async () => {
    const invalidTrackId = 'MusicTrack:00000000-0000-0000-0000-000000000000';

    await expect(useCase.execute(invalidTrackId as any, false)).rejects.toThrow();
    expect(fakeProducer.scheduleBatchAudioScan).not.toHaveBeenCalled();
  });
});
