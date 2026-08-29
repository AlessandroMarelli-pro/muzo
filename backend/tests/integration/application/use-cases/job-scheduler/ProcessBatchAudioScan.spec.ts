import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { MusicLibraryRepository } from 'src/adapters/persistence/repositories/music-library/music-library.repository';
import { MusicTrackRepository } from 'src/adapters/persistence/repositories/music-track/music-track.repository';
import { ScanSessionRepository } from 'src/adapters/persistence/repositories/scan-session/scan-session.repository';
import type { AudioAnalysisBatchResponse } from 'src/application/ports/dtos/AudioAnalysis';
import type {
  AudioFile,
  AudioScanBatchJobData,
} from 'src/application/ports/dtos/JobSchedulersData';
import { AUDIO_ANALYSIS_STRUCTURE } from 'src/application/ports/infrastructure/IAudioAnalysisStructure';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { SCAN_PROGRESS_PUBLISHER } from 'src/application/ports/infrastructure/IScanProgressPublisher';
import { MUSIC_LIBRARY_REPOSITORY } from 'src/application/ports/repositories/IMusicLibraryRepository';
import { MUSIC_TRACK_REPOSITORY } from 'src/application/ports/repositories/IMusicTrackRepository';
import { SCAN_SESSION_REPOSITORY } from 'src/application/ports/repositories/IScanSessionRepository';
import { ProcessBatchAudioScanUseCase } from 'src/application/use-cases/job-scheduler/ProcessBatchAudioScan';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { extractModelId } from 'src/kernel/ids/factory';
import { models } from 'src/kernel/types/models';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeContextUser } from '../../../../_test-utils/make-context-user';
import { createIntegrationPrismaClient, setupIntegrationDb } from '../_test-utils/integration-db';
import { makeLibrary } from '../_test-utils/make-library';

const LIBRARY_ID = models.musicLibrary.id('lib-1');
const TEST_USER_ID = 'test-user-id';
const SESSION_ID = models.session.id('session-1');

const ALREADY_ANALYZED_PATH = '/music/already-done.mp3';
const TRACK1_PATH = '/music/track1.mp3';
const TRACK2_PATH = '/music/track2.mp3';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
}));

function makeBatchJobData(overrides: Partial<AudioScanBatchJobData> = {}): AudioScanBatchJobData {
  return {
    audioFiles: [
      {
        filePath: '/music/track1.mp3',
        fileName: 'track1.mp3',
        fileSize: 1024,
        extension: '.mp3',
        lastModified: new Date(),
        trackIndex: 0,
        libraryId: LIBRARY_ID,
      },
    ],
    sessionId: SESSION_ID,
    contextUser: makeContextUser(TEST_USER_ID),
    startDateTS: Date.now(),
    totalFiles: 1,
    totalBatches: 1,
    batchIndex: 0,
    libraryId: LIBRARY_ID,
    incremental: false,
    ...overrides,
  };
}

describe('ProcessBatchAudioScanUseCase', () => {
  let useCase: ProcessBatchAudioScanUseCase;
  let musicLibraryRepository: MusicLibraryRepository;
  let _musicTrackRepository: MusicTrackRepository;
  let prisma: PrismaClient;
  let cleanupDb: () => Promise<void>;
  let fakeAnalyzeBatch: ReturnType<typeof vi.fn>;
  let fakePublishEvent: ReturnType<typeof vi.fn>;
  let fakePublishError: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const { cleanup } = await setupIntegrationDb();
    cleanupDb = cleanup;

    fakeAnalyzeBatch = vi.fn();
    fakePublishEvent = vi.fn().mockResolvedValue(undefined);
    fakePublishError = vi.fn().mockResolvedValue(undefined);

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
          provide: AUDIO_ANALYSIS_STRUCTURE,
          useValue: {
            analyzeAudioBatch: fakeAnalyzeBatch,
          },
        },
        {
          provide: SCAN_PROGRESS_PUBLISHER,
          useValue: {
            publishEvent: fakePublishEvent,
            publishError: fakePublishError,
          },
        },
        { provide: LOGGER_FACTORY, useValue: loggerFactory },
        { provide: LOGGER, useValue: logger },
        {
          provide: ProcessBatchAudioScanUseCase,
          useFactory: (
            audioAnalysis: { analyzeAudioBatch: typeof fakeAnalyzeBatch },
            trackRepo: MusicTrackRepository,
            publisher: {
              publishEvent: typeof fakePublishEvent;
              publishError: typeof fakePublishError;
            },
            lf: { createLogger: (name: string) => ILogger },
            log: ILogger,
            _scanSession: ScanSessionRepository,
            _libraryRepo: MusicLibraryRepository,
          ) =>
            new ProcessBatchAudioScanUseCase(
              audioAnalysis,
              trackRepo,
              publisher,
              lf,
              log,
              _scanSession,
              _libraryRepo,
            ),
          inject: [
            AUDIO_ANALYSIS_STRUCTURE,
            MUSIC_TRACK_REPOSITORY,
            SCAN_PROGRESS_PUBLISHER,
            LOGGER_FACTORY,
            LOGGER,
            SCAN_SESSION_REPOSITORY,
            MUSIC_LIBRARY_REPOSITORY,
          ],
        },
      ],
    }).compile();

    await module.init();

    useCase = module.get(ProcessBatchAudioScanUseCase);
    musicLibraryRepository = module.get(MUSIC_LIBRARY_REPOSITORY);
    _musicTrackRepository = module.get(MUSIC_TRACK_REPOSITORY);
    prisma = module.get(PRISMA_SERVICE);
  });

  afterAll(async () => {
    await prisma?.$disconnect?.();
    await cleanupDb?.();
  });

  beforeEach(async () => {
    await prisma.trackGenre.deleteMany({});
    await prisma.trackSubgenre.deleteMany({});
    await prisma.musicTrack.deleteMany({});
    await prisma.musicLibrary.deleteMany({});
    await prisma.genre.deleteMany({});
    await prisma.subgenre.deleteMany({});
    fakeAnalyzeBatch.mockReset();
    fakePublishEvent.mockClear();
  });

  /** Seed an already-analyzed track (COMPLETED + genre + subgenre) so areFilesAnalyzed returns true for it. */
  async function seedAlreadyAnalyzedTrack(filePath: string, libraryDbId: string) {
    const genre = await prisma.genre.create({
      data: {
        name: `TestGenre-${Date.now()}`,
        createdById: TEST_USER_ID,
      },
    });
    const subgenre = await prisma.subgenre.create({
      data: {
        name: `TestSubgenre-${Date.now()}`,
        genreId: genre.id,
        createdById: TEST_USER_ID,
      },
    });
    const track = await prisma.musicTrack.create({
      data: {
        filePath,
        fileName: filePath.split('/').pop() ?? 'track.mp3',
        fileSize: 0,
        format: 'mp3',
        duration: 0,
        fileCreatedAt: new Date(),
        analysisStatus: 'COMPLETED',
        analysisStartedAt: new Date(),
        analysisCompletedAt: new Date(),
        createdById: TEST_USER_ID,
        libraryId: libraryDbId,
      },
    });
    await prisma.trackGenre.create({
      data: {
        trackId: track.id,
        genreId: genre.id,
        createdById: TEST_USER_ID,
      },
    });
    await prisma.trackSubgenre.create({
      data: {
        trackId: track.id,
        subgenreId: subgenre.id,
        createdById: TEST_USER_ID,
      },
    });
  }

  describe('execute', () => {
    it('happy path: upserts tracks and returns analysis results when files are not yet analyzed', async () => {
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);

      const batchResponse: AudioAnalysisBatchResponse = {
        status: 'completed',
        total_files: 1,
        successful: 1,
        failed: 0,
        results: [
          {
            status: 'success',
            processing_time: 1,
            processing_mode: 'simple',
            schema_version: 2,
            track: { filename: 'track.mp3', extension: 'mp3', mime_type: 'audio/mpeg', size_bytes: 0, size_mb: 0 },
            audio: null,
            tags: {},
            features: {},
            labels: {},
            classifications: { genre_styles: [], genres: [], styles: [], instruments: [], tags: [] },
            embedding: null,
            warnings: [],
          },
        ],
        processing_time: 1,
        processing_mode: 'batch',
      };
      fakeAnalyzeBatch.mockResolvedValue(batchResponse);

      const data = makeBatchJobData();
      const result = await useCase.execute(data);

      expect(result.isBatchComplete).toBe(false);
      expect(result.files).toHaveLength(1);
      expect(result.analysisResults).toHaveLength(1);
      expect(result.createdTracks).toHaveLength(1);
      expect(result.createdTracks[0].fileInfo.filePath).toBe('/music/track1.mp3');
      expect(fakeAnalyzeBatch).toHaveBeenCalledWith(['/music/track1.mp3'], SESSION_ID, 0);
    });

    it('edge case: when audioFiles is empty, returns batch complete with empty arrays', async () => {
      const data = makeBatchJobData({ audioFiles: [] });
      const result = await useCase.execute(data);

      expect(result.isBatchComplete).toBe(true);
      expect(result.files).toEqual([]);
      expect(result.analysisResults).toEqual([]);
      expect(result.createdTracks).toEqual([]);
      expect(fakeAnalyzeBatch).not.toHaveBeenCalled();
    });

    it('when some files are already analyzed: publishes tracks.already.analyzed and returns only valid files', async () => {
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);
      const libraryDbId = extractModelId(library.id).dbId;
      await seedAlreadyAnalyzedTrack(ALREADY_ANALYZED_PATH, libraryDbId);

      const batchResponse: AudioAnalysisBatchResponse = {
        status: 'completed',
        total_files: 2,
        successful: 2,
        failed: 0,
        results: [
          {
            status: 'success',
            processing_time: 1,
            processing_mode: 'simple',
            schema_version: 2,
            track: { filename: 'track.mp3', extension: 'mp3', mime_type: 'audio/mpeg', size_bytes: 0, size_mb: 0 },
            audio: null,
            tags: {},
            features: {},
            labels: {},
            classifications: { genre_styles: [], genres: [], styles: [], instruments: [], tags: [] },
            embedding: null,
            warnings: [],
          },
          {
            status: 'success',
            processing_time: 1,
            processing_mode: 'simple',
            schema_version: 2,
            track: { filename: 'track.mp3', extension: 'mp3', mime_type: 'audio/mpeg', size_bytes: 0, size_mb: 0 },
            audio: null,
            tags: {},
            features: {},
            labels: {},
            classifications: { genre_styles: [], genres: [], styles: [], instruments: [], tags: [] },
            embedding: null,
            warnings: [],
          },
        ],
        processing_time: 1,
        processing_mode: 'batch',
      };
      fakeAnalyzeBatch.mockResolvedValue(batchResponse);

      const audioFiles: AudioFile[] = [
        {
          filePath: ALREADY_ANALYZED_PATH,
          fileName: 'already-done.mp3',
          fileSize: 100,
          extension: '.mp3',
          lastModified: new Date(),
          trackIndex: 0,
          libraryId: LIBRARY_ID,
        },
        {
          filePath: TRACK1_PATH,
          fileName: 'track1.mp3',
          fileSize: 1024,
          extension: '.mp3',
          lastModified: new Date(),
          trackIndex: 1,
          libraryId: LIBRARY_ID,
        },
        {
          filePath: TRACK2_PATH,
          fileName: 'track2.mp3',
          fileSize: 2048,
          extension: '.mp3',
          lastModified: new Date(),
          trackIndex: 2,
          libraryId: LIBRARY_ID,
        },
      ];
      const data = makeBatchJobData({
        audioFiles,
        totalFiles: 3,
      });

      const result = await useCase.execute(data);

      expect(result.isBatchComplete).toBe(false);
      expect(result.files).toHaveLength(2);
      expect(result.files.map((f) => f.filePath)).toEqual([TRACK1_PATH, TRACK2_PATH]);
      expect(result.createdTracks).toHaveLength(2);
      expect(result.analysisResults).toHaveLength(2);
      expect(fakeAnalyzeBatch).toHaveBeenCalledWith([TRACK1_PATH, TRACK2_PATH], SESSION_ID, 0);

      expect(fakePublishEvent).toHaveBeenCalledTimes(1);
      expect(fakePublishEvent).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({
          type: 'tracks.already.analyzed',
          sessionId: SESSION_ID,
          batchIndex: 0,
          data: expect.objectContaining({
            fileName: ALREADY_ANALYZED_PATH,
          }),
        }),
      );
    });

    it('failure: propagates when audio analysis throws', async () => {
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);
      fakeAnalyzeBatch.mockRejectedValue(new Error('Analysis service unavailable'));

      const data = makeBatchJobData();
      await expect(useCase.execute(data)).rejects.toThrow('Analysis service unavailable');
    });
  });
});
