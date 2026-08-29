import { Test } from '@nestjs/testing';
import { Genre as PrismaGenre, Subgenre as PrismaSubgenre } from '@prisma/client';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { AudioAnalysisRepository } from 'src/adapters/persistence/repositories/audio-analysis/audio-analysis.repository';
import { createMockPrisma } from '../_test-utils/prisma-mock';
import { models } from 'src/kernel/types/models';
import type { AnalysisClassifications, AudioAnalysisResponse } from 'src/application/ports/dtos/AudioAnalysis';
import { MusicTrackId } from 'src/kernel/ids';

const TEST_USER_ID = 'test-user-id';
const TRACK_DB_ID = 'track-1';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
}));

function makeAnalysisResult(overrides: Partial<AudioAnalysisResponse> = {}): AudioAnalysisResponse {
  return {
    status: 'success',
    processing_time: 0,
    processing_mode: 'simple',
    schema_version: 2,
    track: {
      filename: 'track.mp3',
      original_filename: 'track.mp3',
      extension: 'mp3',
      mime_type: 'audio/mpeg',
      size_bytes: 1000,
      size_mb: 0.001,
    },
    audio: {
      sample_rate: 44100,
      duration_s: 180,
      format: 'mp3',
      bitrate: 320,
      channels: 2,
      samples: 7938000,
      bit_depth: 16,
      subtype: 'PCM_16',
    },
    tags: {},
    features: {
      tempo: { value: 120, confidence: 0.9, source: 'tempo_cnn' },
      key: { value: 'C', confidence: null, source: 'skey' },
      camelot_key: { value: '8B', confidence: null, source: 'skey' },
      mode: { value: 'major', confidence: null, source: 'skey' },
      valence: { value: 0.5, confidence: null, source: 'deam' },
      arousal: { value: 0.5, confidence: null, source: 'deam' },
      danceability: { value: 0.7, confidence: null, source: 'discogs_effnet' },
      instrumentalness: { value: 0.2, confidence: null, source: 'discogs_effnet' },
      mood_happy: { value: 0.4, confidence: null, source: 'discogs_effnet' },
      mood_sad: { value: 0.1, confidence: null, source: 'discogs_effnet' },
      mood_relaxed: { value: 0.3, confidence: null, source: 'discogs_effnet' },
      mood_aggressive: { value: 0.2, confidence: null, source: 'discogs_effnet' },
      mood_party: { value: 0.5, confidence: null, source: 'discogs_effnet' },
      voice: { value: 0.8, confidence: null, source: 'discogs_effnet' },
    },
    labels: {
      valence_mood: 'neutral',
      arousal_mood: 'neutral',
      danceability_feeling: 'groovy',
    },
    classifications: {
      genre_styles: [{ genre: 'Rock', style: 'Indie Rock', confidence: 0.6 }],
      genres: [{ genre: 'Rock', confidence: 0.6 }],
      styles: [{ style: 'Indie Rock', genre: 'Rock', confidence: 0.6 }],
      instruments: [{ instrument: 'guitar', confidence: 0.7 }],
      tags: [{ tag: 'energetic', confidence: 0.5 }],
    },
    embedding: { vector: [0.1, 0.2], dim: 2, source: 'discogs_effnet' },
    warnings: [],
    ...overrides,
  };
}

function makePrismaGenreRow(overrides: Partial<PrismaGenre> = {}): PrismaGenre {
  return {
    id: 'genre-1',
    name: 'rock',
    description: null,
    createdAt: new Date(),
    createdById: TEST_USER_ID,
    updatedAt: null,
    updatedById: null,
    ...overrides,
  };
}

function makePrismaSubgenreRow(overrides: Partial<PrismaSubgenre> = {}): PrismaSubgenre {
  return {
    id: 'subgenre-1',
    name: 'indie rock',
    description: null,
    genreId: null,
    createdAt: new Date(),
    createdById: TEST_USER_ID,
    updatedAt: null,
    updatedById: null,
    ...overrides,
  };
}

describe('AudioAnalysisRepository', () => {
  let repo: AudioAnalysisRepository;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [AudioAnalysisRepository, { provide: PRISMA_SERVICE, useValue: prismaMock }],
    }).compile();
    repo = module.get(AudioAnalysisRepository);
  });

  describe('upsertAudioFingerprint', () => {
    it('optimal: upserts fingerprint for track and resolves', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      const analysisResult = makeAnalysisResult();
      prismaMock.audioFingerprint.upsert.mockResolvedValue({} as never);

      await repo.upsertAudioFingerprint(trackId, analysisResult);

      const expectedData = {
        tempo: 120,
        tempoConfidence: 0.9,
        key: 'C',
        camelotKey: '8B',
        mode: 'major',
        valence: 0.5,
        arousal: 0.5,
        danceability: 0.7,
        instrumentalness: 0.2,
        moodHappy: 0.4,
        moodSad: 0.1,
        moodRelaxed: 0.3,
        moodAggressive: 0.2,
        moodParty: 0.5,
        voice: 0.8,
        valenceMood: 'neutral',
        arousalMood: 'neutral',
        danceabilityFeeling: 'groovy',
        instruments: JSON.stringify([{ instrument: 'guitar', confidence: 0.7 }]),
        tags: JSON.stringify([{ tag: 'energetic', confidence: 0.5 }]),
        embedding: JSON.stringify([0.1, 0.2]),
        embeddingDim: 2,
        schemaVersion: 2,
        warnings: JSON.stringify([]),
      };

      expect(prismaMock.audioFingerprint.upsert).toHaveBeenCalledWith({
        where: {
          trackId: TRACK_DB_ID,
          createdById: TEST_USER_ID,
        },
        update: expectedData,
        create: { ...expectedData, trackId: TRACK_DB_ID, createdById: TEST_USER_ID },
      });
    });

    it('optimal: null features/labels become null columns, not 0/"" placeholders', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      const analysisResult = makeAnalysisResult({
        features: {},
        labels: {},
        classifications: { genre_styles: [], genres: [], styles: [], instruments: [], tags: [] },
        embedding: null,
        warnings: [{ model: 'deam', reason: 'failed', detail: 'timeout' }],
      });
      prismaMock.audioFingerprint.upsert.mockResolvedValue({} as never);

      await repo.upsertAudioFingerprint(trackId, analysisResult);

      expect(prismaMock.audioFingerprint.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            tempo: null,
            key: null,
            valence: null,
            danceability: null,
            valenceMood: null,
            embedding: JSON.stringify([]),
            embeddingDim: null,
            warnings: JSON.stringify([{ model: 'deam', reason: 'failed', detail: 'timeout' }]),
          }),
        }),
      );
    });

    it('failure: rethrows when Prisma upsert throws', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      const analysisResult = makeAnalysisResult();
      const prismaError = new Error('Unique constraint failed');
      prismaMock.audioFingerprint.upsert.mockRejectedValue(prismaError);

      await expect(repo.upsertAudioFingerprint(trackId, analysisResult)).rejects.toThrow(
        'Unique constraint failed',
      );
    });

    it('createdById scope: upsert where and create/update use current user id', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      const analysisResult = makeAnalysisResult();
      prismaMock.audioFingerprint.upsert.mockResolvedValue({} as never);

      await repo.upsertAudioFingerprint(trackId, analysisResult);

      expect(prismaMock.audioFingerprint.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdById: TEST_USER_ID }),
        }),
      );
    });
  });

  describe('upsertTrackGenresFromClassifications', () => {
    const classifications: AnalysisClassifications = {
      genre_styles: [
        { genre: 'Rock', style: 'Indie Rock', confidence: 0.6 },
        { genre: 'Electronic', style: 'Deep House', confidence: 0.2 },
      ],
      genres: [
        { genre: 'Rock', confidence: 0.6 },
        { genre: 'Electronic', confidence: 0.2 },
      ],
      styles: [
        { style: 'Indie Rock', genre: 'Rock', confidence: 0.6 },
        { style: 'Deep House', genre: 'Electronic', confidence: 0.2 },
      ],
      instruments: [],
      tags: [],
    };

    it('optimal: deletes existing associations, finds or creates genres/subgenres with confidence, links parent genre', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.trackGenre.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.trackSubgenre.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.genre.findUnique
        .mockResolvedValueOnce(makePrismaGenreRow({ id: 'g1', name: 'rock' }))
        .mockResolvedValueOnce(null);
      prismaMock.genre.create.mockResolvedValue(
        makePrismaGenreRow({ id: 'g2', name: 'electronic' }),
      );
      prismaMock.trackGenre.create.mockResolvedValue({} as never);
      prismaMock.subgenre.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prismaMock.subgenre.create
        .mockResolvedValueOnce(
          makePrismaSubgenreRow({ id: 'sg1', name: 'indie rock', genreId: 'g1' }),
        )
        .mockResolvedValueOnce(
          makePrismaSubgenreRow({ id: 'sg2', name: 'deep house', genreId: 'g2' }),
        );
      prismaMock.trackSubgenre.create.mockResolvedValue({} as never);

      await repo.upsertTrackGenresFromClassifications(trackId, classifications);

      expect(prismaMock.trackGenre.deleteMany).toHaveBeenCalledWith({
        where: { trackId: TRACK_DB_ID, createdById: TEST_USER_ID },
      });
      expect(prismaMock.trackSubgenre.deleteMany).toHaveBeenCalledWith({
        where: { trackId: TRACK_DB_ID, createdById: TEST_USER_ID },
      });

      expect(prismaMock.trackGenre.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ genreId: 'g1', confidence: 0.6 }),
      });
      expect(prismaMock.trackGenre.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ genreId: 'g2', confidence: 0.2 }),
      });

      // Subgenre for "Indie Rock" (parent "Rock") should be created with genreId 'g1'
      expect(prismaMock.subgenre.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'indie rock', genreId: 'g1' }),
      });
      expect(prismaMock.subgenre.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'deep house', genreId: 'g2' }),
      });
      expect(prismaMock.trackSubgenre.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ subgenreId: 'sg1', confidence: 0.6 }),
      });
      expect(prismaMock.trackSubgenre.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ subgenreId: 'sg2', confidence: 0.2 }),
      });
    });

    it('optimal: skips empty or whitespace-only names', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.trackGenre.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.trackSubgenre.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.genre.findUnique.mockResolvedValue(makePrismaGenreRow({ name: 'valid' }));
      prismaMock.trackGenre.create.mockResolvedValue({} as never);
      prismaMock.subgenre.findUnique.mockResolvedValue(null);
      prismaMock.subgenre.create.mockResolvedValue(makePrismaSubgenreRow({ name: 'valid style' }));
      prismaMock.trackSubgenre.create.mockResolvedValue({} as never);

      await repo.upsertTrackGenresFromClassifications(trackId, {
        genre_styles: [],
        genres: [
          { genre: '', confidence: 0.5 },
          { genre: '  ', confidence: 0.5 },
          { genre: 'Valid', confidence: 0.5 },
        ],
        styles: [
          { style: '', genre: 'Valid', confidence: 0.5 },
          { style: 'Valid Style', genre: 'Valid', confidence: 0.5 },
        ],
        instruments: [],
        tags: [],
      });

      expect(prismaMock.genre.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.trackGenre.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.subgenre.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.trackSubgenre.create).toHaveBeenCalledTimes(1);
    });

    it('failure: rethrows when Prisma deleteMany throws', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.trackGenre.deleteMany.mockRejectedValue(new Error('Connection lost'));

      await expect(
        repo.upsertTrackGenresFromClassifications(trackId, classifications),
      ).rejects.toThrow('Connection lost');
    });
  });

  describe('updateEmbedding', () => {
    it('optimal: updates embedding and embeddingDim', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.audioFingerprint.update.mockResolvedValue({} as never);

      await repo.updateEmbedding(trackId, [0.1, 0.2, 0.3]);

      expect(prismaMock.audioFingerprint.update).toHaveBeenCalledWith({
        where: { trackId: TRACK_DB_ID, createdById: TEST_USER_ID },
        data: { embedding: JSON.stringify([0.1, 0.2, 0.3]), embeddingDim: 3 },
      });
    });
  });

  describe('updateDiscogsClassifiers', () => {
    it('optimal: writes classifiers and tempo onto the renamed columns', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.audioFingerprint.update.mockResolvedValue({} as never);

      await repo.updateDiscogsClassifiers(
        trackId,
        {
          danceable: 0.7,
          mood_aggressive: 0.1,
          mood_happy: 0.5,
          mood_party: 0.4,
          mood_relaxed: 0.3,
          mood_sad: 0.2,
          voice: 0.9,
          instruments: [{ instrument: 'guitar', confidence: 0.6 }],
          tags: [{ tag: 'chill', confidence: 0.4 }],
        },
        { tempo: 128, confidence: 0.85 },
      );

      expect(prismaMock.audioFingerprint.update).toHaveBeenCalledWith({
        where: { trackId: TRACK_DB_ID, createdById: TEST_USER_ID },
        data: {
          danceability: 0.7,
          moodAggressive: 0.1,
          moodHappy: 0.5,
          moodParty: 0.4,
          moodRelaxed: 0.3,
          moodSad: 0.2,
          voice: 0.9,
          instruments: JSON.stringify([{ instrument: 'guitar', confidence: 0.6 }]),
          tags: JSON.stringify([{ tag: 'chill', confidence: 0.4 }]),
          tempo: 128,
          tempoConfidence: 0.85,
        },
      });
    });
  });
});
