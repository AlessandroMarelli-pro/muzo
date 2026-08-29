import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessSingleTrackAnalysisUseCase } from 'src/application/use-cases/job-scheduler/ProcessSingleTrackAnalysis';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { AUDIO_ANALYSIS_REPOSITORY } from 'src/application/ports/repositories/IAudioAnalysisRepository';
import { MUSIC_TRACK_REPOSITORY } from 'src/application/ports/repositories/IMusicTrackRepository';
import { SCAN_PROGRESS_PUBLISHER } from 'src/application/ports/infrastructure/IScanProgressPublisher';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { LOGGER } from 'src/application/ports/infrastructure/ILogger';
import type { AudioAnalysisResponse } from 'src/application/ports/dtos/AudioAnalysis';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { AudioAnalysisRepository } from 'src/adapters/persistence/repositories/audio-analysis/audio-analysis.repository';
import { MusicLibraryRepository } from 'src/adapters/persistence/repositories/music-library/music-library.repository';
import { MusicTrackRepository } from 'src/adapters/persistence/repositories/music-track/music-track.repository';
import { MUSIC_LIBRARY_REPOSITORY } from 'src/application/ports/repositories/IMusicLibraryRepository';
import { extractModelId } from 'src/kernel/ids/factory';
import { models } from 'src/kernel/types/models';
import type { MusicTrack } from 'src/kernel/types';
import { AudioFileAnalysisStatusEnum } from 'src/kernel/types';
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

function makeValidAnalysisResult(
  overrides: Partial<AudioAnalysisResponse> = {},
): AudioAnalysisResponse {
  return {
    status: 'success',
    processing_time: 0,
    processing_mode: 'simple',
    schema_version: 2,
    track: {
      filename: 'track.mp3',
      extension: 'mp3',
      mime_type: 'audio/mpeg',
      size_bytes: 1024,
      size_mb: 0.001,
    },
    audio: {
      sample_rate: 44100,
      duration_s: 120,
      format: 'mp3',
      bitrate: 128,
      channels: 2,
      samples: 0,
      bit_depth: 16,
      subtype: 'mp3',
    },
    tags: { artist: 'Test Artist', title: 'Test Title' },
    features: {},
    labels: {},
    classifications: {
      genre_styles: [{ genre: 'Pop', style: 'Indie Pop', confidence: 0.7 }],
      genres: [{ genre: 'Pop', confidence: 0.7 }],
      styles: [{ style: 'Indie Pop', genre: 'Pop', confidence: 0.7 }],
      instruments: [],
      tags: [],
    },
    embedding: null,
    warnings: [],
    ...overrides,
  };
}

describe('ProcessSingleTrackAnalysisUseCase', () => {
  let useCase: ProcessSingleTrackAnalysisUseCase;
  let musicLibraryRepository: MusicLibraryRepository;
  let musicTrackRepository: MusicTrackRepository;
  let prisma: PrismaClient;
  let cleanupDb: () => Promise<void>;
  let fakePublishEvent: ReturnType<typeof vi.fn>;
  let fakePublishError: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const { cleanup } = await setupIntegrationDb();
    cleanupDb = cleanup;

    fakePublishEvent = vi.fn().mockResolvedValue(undefined);
    fakePublishError = vi.fn().mockResolvedValue(undefined);

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

    const module = await Test.createTestingModule({
      providers: [
        { provide: PRISMA_SERVICE, useValue: testPrisma },
        { provide: MUSIC_LIBRARY_REPOSITORY, useClass: MusicLibraryRepository },
        { provide: MUSIC_TRACK_REPOSITORY, useClass: MusicTrackRepository },
        {
          provide: AUDIO_ANALYSIS_REPOSITORY,
          useClass: AudioAnalysisRepository,
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
          provide: ProcessSingleTrackAnalysisUseCase,
          useFactory: (
            trackRepo: MusicTrackRepository,
            publisher: {
              publishEvent: typeof fakePublishEvent;
              publishError: typeof fakePublishError;
            },
            audioRepo: AudioAnalysisRepository,
            lf: { createLogger: (name: string) => ILogger },
            log: ILogger,
          ) => new ProcessSingleTrackAnalysisUseCase(trackRepo, publisher, audioRepo, lf, log),
          inject: [
            MUSIC_TRACK_REPOSITORY,
            SCAN_PROGRESS_PUBLISHER,
            AUDIO_ANALYSIS_REPOSITORY,
            LOGGER_FACTORY,
            LOGGER,
          ],
        },
      ],
    }).compile();

    await module.init();

    useCase = module.get(ProcessSingleTrackAnalysisUseCase);
    musicLibraryRepository = module.get(MUSIC_LIBRARY_REPOSITORY);
    musicTrackRepository = module.get(MUSIC_TRACK_REPOSITORY);
    prisma = module.get(PRISMA_SERVICE);
  });

  afterAll(async () => {
    await prisma?.$disconnect?.();
    await cleanupDb?.();
  });

  beforeEach(async () => {
    await prisma.audioFingerprint.deleteMany({});
    await prisma.trackGenre.deleteMany({});
    await prisma.trackSubgenre.deleteMany({});
    await prisma.trackAiAtmosphereTag.deleteMany({});
    await prisma.aiAtmosphereTag.deleteMany({});
    await prisma.musicTrack.deleteMany({});
    await prisma.musicLibrary.deleteMany({});
    await prisma.genre.deleteMany({});
    await prisma.subgenre.deleteMany({});
    fakePublishEvent.mockClear();
    fakePublishError.mockClear();
  });

  describe('execute', () => {
    it('happy path: updates track with analysis and publishes track.complete with correct batchInfo', async () => {
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);
      const track = await musicTrackRepository.upsertOne({
        filePath: '/music/single.mp3',
        libraryId: LIBRARY_ID,
        fileName: 'single.mp3',
        fileSize: 1024,
        analysisStatus: AudioFileAnalysisStatusEnum.PROCESSING,
        analysisStartedAt: new Date(),
        duration: 0,
        format: 'mp3',
        fileCreatedAt: new Date(),
        analysisCompletedAt: new Date(),
        analysisError: '',
      });

      const analysisResult = makeValidAnalysisResult();
      const batchInfo = {
        trackIndex: 0,
        sessionId: SESSION_ID,
        batchIndex: 0,
        totalTracks: 1,
        libraryId: LIBRARY_ID,
      };

      const result = await useCase.execute(track, analysisResult, batchInfo);

      expect(result.isSuccess).toBe(true);
      expect(fakePublishEvent).toHaveBeenCalledTimes(1);
      expect(fakePublishEvent).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({
          type: 'track.complete',
          sessionId: SESSION_ID,
          libraryId: LIBRARY_ID,
          batchIndex: 0,
          data: expect.objectContaining({
            totalTracks: 1,
            trackIndex: 0,
            fileName: 'single.mp3',
          }),
        }),
      );

      const updated = await musicTrackRepository.getOneById(track.id);
      expect(updated.analysisInfo?.status).toBe(AudioFileAnalysisStatusEnum.COMPLETED);
      expect(updated.title).toBe('Test Title');
      expect(updated.artist).toBe('Test Artist');
    });

    it('when the ai-service reports a hard failure: marks track FAILED (not deleted) and still publishes track.complete', async () => {
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);
      const track = await musicTrackRepository.upsertOne({
        filePath: '/music/no-meta.mp3',
        libraryId: LIBRARY_ID,
        fileName: 'no-meta.mp3',
        fileSize: 1024,
        analysisStatus: AudioFileAnalysisStatusEnum.PROCESSING,
        analysisStartedAt: new Date(),
        duration: 0,
        format: 'mp3',
        fileCreatedAt: new Date(),
        analysisCompletedAt: new Date(),
        analysisError: '',
      });

      const badAnalysis = makeValidAnalysisResult({
        status: 'error',
        message: 'audio decode failed',
      });
      const batchInfo = {
        trackIndex: 0,
        sessionId: SESSION_ID,
        batchIndex: 0,
        totalTracks: 1,
        libraryId: LIBRARY_ID,
      };

      const result = await useCase.execute(track, badAnalysis, batchInfo);

      expect(result.isSuccess).toBe(false);
      const updated = await musicTrackRepository.getOneById(track.id);
      expect(updated.analysisInfo?.status).toBe(AudioFileAnalysisStatusEnum.FAILED);
      expect(updated.analysisInfo?.error).toBe('audio decode failed');
      expect(fakePublishEvent).toHaveBeenCalledTimes(1);
      expect(fakePublishEvent).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({
          type: 'track.complete',
          data: expect.objectContaining({ fileName: 'no-meta.mp3' }),
        }),
      );
    });

    it('when a successful analysis has no ID3 artist/title: still processes and completes (no metadata deletion)', async () => {
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);
      const track = await musicTrackRepository.upsertOne({
        filePath: '/music/untagged.mp3',
        libraryId: LIBRARY_ID,
        fileName: 'untagged.mp3',
        fileSize: 1024,
        analysisStatus: AudioFileAnalysisStatusEnum.PROCESSING,
        analysisStartedAt: new Date(),
        duration: 0,
        format: 'mp3',
        fileCreatedAt: new Date(),
        analysisCompletedAt: new Date(),
        analysisError: '',
      });

      const analysisResult = makeValidAnalysisResult({ tags: {} });
      const batchInfo = {
        trackIndex: 0,
        sessionId: SESSION_ID,
        batchIndex: 0,
        totalTracks: 1,
        libraryId: LIBRARY_ID,
      };

      const result = await useCase.execute(track, analysisResult, batchInfo);

      expect(result.isSuccess).toBe(true);
      const updated = await musicTrackRepository.getOneById(track.id);
      expect(updated.analysisInfo?.status).toBe(AudioFileAnalysisStatusEnum.COMPLETED);
    });

    it('multiple batches: publishEvent receives correct totalTracks, batchIndex, and trackIndex for each track', async () => {
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);

      const totalTracks = 4;
      const tracksPerBatch = 2;
      const totalBatches = 2;
      const filePaths = ['/music/a.mp3', '/music/b.mp3', '/music/c.mp3', '/music/d.mp3'];
      const tracks: MusicTrack[] = [];
      for (const filePath of filePaths) {
        const t = await musicTrackRepository.upsertOne({
          filePath,
          libraryId: LIBRARY_ID,
          fileName: filePath.split('/').pop()!,
          fileSize: 1024,
          analysisStatus: AudioFileAnalysisStatusEnum.PROCESSING,
          analysisStartedAt: new Date(),
          duration: 0,
          format: 'mp3',
          fileCreatedAt: new Date(),
          analysisCompletedAt: new Date(),
          analysisError: '',
        });
        tracks.push(t);
      }

      const analysisResult = makeValidAnalysisResult();
      let publishCallIndex = 0;
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        for (let i = 0; i < tracksPerBatch; i++) {
          const trackIndex = batchIndex * tracksPerBatch + i;
          const track = tracks[trackIndex]!;
          const result = await useCase.execute(track, analysisResult, {
            trackIndex,
            sessionId: SESSION_ID,
            batchIndex,
            totalTracks,
            libraryId: LIBRARY_ID,
          });
          expect(result.isSuccess).toBe(true);

          const event = fakePublishEvent.mock.calls[publishCallIndex];
          expect(event).toBeDefined();
          expect(event[0]).toBe(SESSION_ID);
          expect(event[1]).toMatchObject({
            type: 'track.complete',
            sessionId: SESSION_ID,
            libraryId: LIBRARY_ID,
            batchIndex,
            data: {
              totalTracks,
              trackIndex,
              fileName: track.fileInfo.fileName,
            },
          });
          publishCallIndex++;
        }
      }

      expect(fakePublishEvent).toHaveBeenCalledTimes(totalTracks);
      const calls = fakePublishEvent.mock.calls;
      expect(calls[0]![1]).toMatchObject({
        batchIndex: 0,
        data: { totalTracks: 4, trackIndex: 0 },
      });
      expect(calls[1]![1]).toMatchObject({
        batchIndex: 0,
        data: { totalTracks: 4, trackIndex: 1 },
      });
      expect(calls[2]![1]).toMatchObject({
        batchIndex: 1,
        data: { totalTracks: 4, trackIndex: 2 },
      });
      expect(calls[3]![1]).toMatchObject({
        batchIndex: 1,
        data: { totalTracks: 4, trackIndex: 3 },
      });
    });

    it('happy path: when analysis has genre/style classifications, upserts TrackGenre/TrackSubgenre for track', async () => {
      const library = makeLibrary({ id: 'lib-1' });
      await musicLibraryRepository.save(library);
      const track = await musicTrackRepository.upsertOne({
        filePath: '/music/with-genres.mp3',
        libraryId: LIBRARY_ID,
        fileName: 'with-genres.mp3',
        fileSize: 1024,
        analysisStatus: AudioFileAnalysisStatusEnum.PROCESSING,
        analysisStartedAt: new Date(),
        duration: 0,
        format: 'mp3',
        fileCreatedAt: new Date(),
        analysisCompletedAt: new Date(),
        analysisError: '',
      });

      const analysisResult = makeValidAnalysisResult({
        classifications: {
          genre_styles: [
            { genre: 'Electronic', style: 'Deep House', confidence: 0.62 },
            { genre: 'Funk / Soul', style: 'Disco', confidence: 0.18 },
          ],
          genres: [
            { genre: 'Electronic', confidence: 0.62 },
            { genre: 'Funk / Soul', confidence: 0.18 },
          ],
          styles: [
            { style: 'Deep House', genre: 'Electronic', confidence: 0.62 },
            { style: 'Disco', genre: 'Funk / Soul', confidence: 0.18 },
          ],
          instruments: [],
          tags: [],
        },
      });
      const batchInfo = {
        trackIndex: 0,
        sessionId: SESSION_ID,
        batchIndex: 0,
        totalTracks: 1,
        libraryId: LIBRARY_ID,
      };

      const result = await useCase.execute(track, analysisResult, batchInfo);

      expect(result.isSuccess).toBe(true);
      const trackDbId = extractModelId(track.id).dbId;
      const trackGenres = await prisma.trackGenre.findMany({
        where: { trackId: trackDbId },
        include: { genre: true },
      });
      const trackSubgenres = await prisma.trackSubgenre.findMany({
        where: { trackId: trackDbId },
        include: { subgenre: true },
      });
      expect(trackGenres.map((tg) => tg.genre.name).sort()).toEqual(
        ['electronic', 'funk / soul'].sort(),
      );
      expect(trackSubgenres.map((ts) => ts.subgenre.name).sort()).toEqual(
        ['deep house', 'disco'].sort(),
      );
      const deepHouse = trackSubgenres.find((ts) => ts.subgenre.name === 'deep house');
      const electronicGenre = trackGenres.find((tg) => tg.genre.name === 'electronic');
      expect(deepHouse?.subgenre.genreId).toBe(electronicGenre?.genreId);
    });
  });
});
