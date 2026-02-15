import { Test } from '@nestjs/testing';
import { Genre as PrismaGenre, Subgenre as PrismaSubgenre } from '@prisma/client';
import {
  PRISMA_SERVICE,
  PrismaService,
} from 'src/infrastructure/database/prisma.service';
import { AudioAnalysisRepository } from 'src/adapters/persistence/repositories/audio-analysis/audio-analysis.repository';
import { createMockPrisma } from '../_test-utils/prisma-mock';
import { models } from 'src/kernel/types/models';
import type { AudioAnalysisResponse } from 'src/application/ports/dtos/AudioAnalysis';
import { MusicTrackId } from 'src/kernel/ids';

const TEST_USER_ID = 'test-user-id';
const TRACK_DB_ID = 'track-1';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: `User:${TEST_USER_ID}` })),
}));

function makeAnalysisResult(
  overrides: Partial<AudioAnalysisResponse> = {},
): AudioAnalysisResponse {
  return {
    status: 'success',
    processing_time: 0,
    processing_mode: 'single',
    features: {
      musical_features: {
        tempo: 120,
        key: 'C',
        camelot_key: '8B',
        valence: 0.5,
        valence_mood: 'neutral',
        arousal: 0.5,
        arousal_mood: 'neutral',
        danceability: 0.7,
        danceability_feeling: 'groovy',
        acousticness: 0.3,
        instrumentalness: 0.2,
        speechiness: 0.1,
        liveness: 0.1,
        energy_comment: '',
        energy_keywords: [],
        mood_calculation: {
          mode_factor: 0.5,
          mode_confidence: 0.8,
          mode_weight: 0.5,
          tempo_factor: 0.5,
          energy_factor: 0.5,
          brightness_factor: 0.5,
          harmonic_factor: 0.5,
          spectral_balance: 0.5,
          beat_strength: 0.5,
          syncopation: 0.5,
        },
        danceability_calculation: {
          rhythm_stability: 0.8,
          bass_presence: 0.6,
          tempo_regularity: 0.7,
          tempo_appropriateness: 0.7,
          energy_factor: 0.6,
          syncopation: 0.2,
          beat_strength: 0.5,
        },
      },
      spectral_features: {
        mfcc_mean: [0, 0],
        spectral_centroids: { mean: 0, std: 0, median: 0, min: 0, max: 0, p25: 0, p75: 0 },
        spectral_rolloffs: { mean: 0, std: 0, median: 0, min: 0, max: 0, p25: 0, p75: 0 },
        spectral_spreads: { mean: 0, std: 0, median: 0, min: 0, max: 0, p25: 0, p75: 0 },
        spectral_bandwidths: { mean: 0, std: 0, median: 0, min: 0, max: 0, p25: 0, p75: 0 },
        spectral_flatnesses: { mean: 0, std: 0, median: 0, min: 0, max: 0, p25: 0, p75: 0 },
        zero_crossing_rate: { mean: 0, std: 0, median: 0, min: 0, max: 0, p25: 0, p75: 0 },
        rms: { mean: 0, std: 0, median: 0, min: 0, max: 0, p25: 0, p75: 0 },
        energy_by_band: [],
        energy_ratios: [],
      },
      melodic_fingerprint: {
        chroma: { mean: [], std: [], max: [], overall_mean: 0, overall_std: 0, dominant_pitch: 0 },
        tonnetz: { mean: [], std: [], max: [], overall_mean: 0, overall_std: 0 },
      },
      rhythm_fingerprint: { zcr_mean: 0, zcr_std: 0 },
    },
    fingerprint: {
      audio_hash: 'audio-hash-1',
      file_hash: 'file-hash-1',
      method: 'test',
    },
    hierarchical_classification: {} as AudioAnalysisResponse['hierarchical_classification'],
    album_art: {} as AudioAnalysisResponse['album_art'],
    file_info: {} as AudioAnalysisResponse['file_info'],
    audio_technical: {} as AudioAnalysisResponse['audio_technical'],
    id3_tags: {} as AudioAnalysisResponse['id3_tags'],
    ai_metadata: {
      artist: '',
      title: '',
      genre: [],
      style: [],
      tags: [],
    },
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

function makePrismaSubgenreRow(
  overrides: Partial<PrismaSubgenre> = {},
): PrismaSubgenre {
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
      providers: [
        AudioAnalysisRepository,
        { provide: PRISMA_SERVICE, useValue: prismaMock },
      ],
    }).compile();
    repo = module.get(AudioAnalysisRepository);
  });

  describe('upsertAudioFingerprint', () => {
    it('optimal: upserts fingerprint for track and resolves', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      const analysisResult = makeAnalysisResult();
      prismaMock.audioFingerprint.upsert.mockResolvedValue({} as never);

      await repo.upsertAudioFingerprint(trackId, analysisResult);

      const f = analysisResult.features;
      const mf = f.musical_features;
      const sf = f.spectral_features;
      const mel = f.melodic_fingerprint;
      const fp = analysisResult.fingerprint;

      const expectedData = {
        trackId: TRACK_DB_ID,
        mfcc: JSON.stringify(sf.mfcc_mean ?? []),
        spectralCentroid: JSON.stringify(sf.spectral_centroids ?? {}),
        spectralRolloff: JSON.stringify(sf.spectral_rolloffs ?? {}),
        spectralContrast: JSON.stringify([]),
        chroma: JSON.stringify(mel.chroma ?? {}),
        spectralSpread: JSON.stringify(sf.spectral_spreads ?? {}),
        spectralBandwith: JSON.stringify(sf.spectral_bandwidths ?? {}),
        spectralFlatness: JSON.stringify(sf.spectral_flatnesses ?? {}),
        zeroCrossingRate: JSON.stringify(sf.zero_crossing_rate ?? {}),
        tempo: mf.tempo ?? 0,
        key: mf.key ?? '',
        valence: mf.valence ?? 0,
        danceability: mf.danceability ?? 0,
        arousal: mf.arousal ?? 0,
        acousticness: mf.acousticness ?? 0,
        instrumentalness: mf.instrumentalness ?? 0,
        speechiness: mf.speechiness ?? 0,
        liveness: mf.liveness ?? 0,
        audioHash: fp.audio_hash ?? '',
        fileHash: fp.file_hash ?? '',
        tonnetz: JSON.stringify(mel.tonnetz ?? {}),
        camelotKey: mf.camelot_key ?? '',
        valenceMood: mf.valence_mood ?? '',
        arousalMood: mf.arousal_mood ?? '',
        danceabilityFeeling: mf.danceability_feeling ?? '',
        rhythmStability: mf.danceability_calculation?.rhythm_stability ?? 0,
        bassPresence: mf.danceability_calculation?.bass_presence ?? 0,
        tempoRegularity: mf.danceability_calculation?.tempo_regularity ?? 0,
        tempoAppropriateness:
          mf.danceability_calculation?.tempo_appropriateness ?? 0,
        energyFactor: mf.danceability_calculation?.energy_factor ?? 0,
        syncopation: mf.danceability_calculation?.syncopation ?? 0,
        modeFactor: mf.mood_calculation?.mode_factor ?? 0,
        modeConfidence: mf.mood_calculation?.mode_confidence ?? 0,
        modeWeight: mf.mood_calculation?.mode_weight ?? 0,
        tempoFactor: mf.mood_calculation?.tempo_factor ?? 0,
        brightnessFactor: mf.mood_calculation?.brightness_factor ?? 0,
      };

      expect(prismaMock.audioFingerprint.upsert).toHaveBeenCalledWith({
        where: {
          trackId: TRACK_DB_ID,
          createdById: TEST_USER_ID,
        },
        update: expectedData,
        create: expectedData,
      });
    });

    it('failure: rethrows when Prisma upsert throws', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      const analysisResult = makeAnalysisResult();
      const prismaError = new Error('Unique constraint failed');
      prismaMock.audioFingerprint.upsert.mockRejectedValue(prismaError);

      await expect(
        repo.upsertAudioFingerprint(trackId, analysisResult),
      ).rejects.toThrow('Unique constraint failed');
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

  describe('upsertTrackGenres', () => {
    it('optimal: deletes existing track genres, finds or creates genres, creates track-genre links', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      const genres = ['Rock', 'Indie'];
      prismaMock.trackGenre.deleteMany.mockResolvedValue({ count: 2 });
      prismaMock.genre.findUnique
        .mockResolvedValueOnce(makePrismaGenreRow({ id: 'g1', name: 'rock' }))
        .mockResolvedValueOnce(null);
      prismaMock.genre.create.mockResolvedValue(
        makePrismaGenreRow({ id: 'g2', name: 'indie' }),
      );
      prismaMock.trackGenre.create.mockResolvedValue({} as never);

      await repo.upsertTrackGenres(trackId, genres);

      expect(prismaMock.trackGenre.deleteMany).toHaveBeenCalledWith({
        where: {
          trackId: TRACK_DB_ID,
          createdById: TEST_USER_ID,
        },
      });
      expect(prismaMock.genre.findUnique).toHaveBeenCalledWith({
        where: { name: 'rock', createdById: TEST_USER_ID },
      });
      expect(prismaMock.genre.findUnique).toHaveBeenCalledWith({
        where: { name: 'indie', createdById: TEST_USER_ID },
      });
      expect(prismaMock.genre.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.trackGenre.create).toHaveBeenCalledTimes(2);
    });

    it('failure: rethrows when Prisma deleteMany throws', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.trackGenre.deleteMany.mockRejectedValue(
        new Error('Connection lost'),
      );

      await expect(
        repo.upsertTrackGenres(trackId, ['Rock']),
      ).rejects.toThrow('Connection lost');
    });

    it('createdById scope: deleteMany, findUnique, create use current user id', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.trackGenre.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.genre.findUnique.mockResolvedValue(
        makePrismaGenreRow({ name: 'rock' }),
      );
      prismaMock.trackGenre.create.mockResolvedValue({} as never);

      await repo.upsertTrackGenres(trackId, ['Rock']);

      expect(prismaMock.trackGenre.deleteMany).toHaveBeenCalledWith({
        where: { trackId: TRACK_DB_ID, createdById: TEST_USER_ID },
      });
      expect(prismaMock.genre.findUnique).toHaveBeenCalledWith({
        where: { name: 'rock', createdById: TEST_USER_ID },
      });
      expect(prismaMock.trackGenre.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ createdById: TEST_USER_ID }),
      });
    });

    it('optimal: skips empty or whitespace-only genre names', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.trackGenre.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.genre.findUnique.mockResolvedValue(
        makePrismaGenreRow({ name: 'valid' }),
      );
      prismaMock.trackGenre.create.mockResolvedValue({} as never);

      await repo.upsertTrackGenres(trackId, ['', '  ', 'Valid']);

      expect(prismaMock.genre.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.genre.findUnique).toHaveBeenCalledWith({
        where: { name: 'valid', createdById: TEST_USER_ID },
      });
      expect(prismaMock.trackGenre.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('upsertTrackSubgenres', () => {
    it('optimal: deletes existing track subgenres, finds or creates subgenres, creates track-subgenre links', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      const subgenres = ['Indie Rock', 'Post-Punk'];
      prismaMock.trackSubgenre.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.subgenre.findUnique.mockResolvedValueOnce(
        makePrismaSubgenreRow({ id: 'sg1', name: 'indie rock' }),
      );
      prismaMock.subgenre.findUnique.mockResolvedValueOnce(null);
      prismaMock.subgenre.create.mockResolvedValue(
        makePrismaSubgenreRow({ id: 'sg2', name: 'post-punk' }),
      );
      prismaMock.trackSubgenre.create.mockResolvedValue({} as never);

      await repo.upsertTrackSubgenres(trackId, subgenres);

      expect(prismaMock.trackSubgenre.deleteMany).toHaveBeenCalledWith({
        where: {
          trackId: TRACK_DB_ID,
          createdById: TEST_USER_ID,
        },
      });
      expect(prismaMock.subgenre.findUnique).toHaveBeenCalledWith({
        where: { name: 'indie rock', createdById: TEST_USER_ID },
      });
      expect(prismaMock.subgenre.findUnique).toHaveBeenCalledWith({
        where: { name: 'post-punk', createdById: TEST_USER_ID },
      });
      expect(prismaMock.subgenre.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.trackSubgenre.create).toHaveBeenCalledTimes(2);
    });

    it('failure: rethrows when Prisma deleteMany throws', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.trackSubgenre.deleteMany.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        repo.upsertTrackSubgenres(trackId, ['Indie']),
      ).rejects.toThrow('DB error');
    });

    it('createdById scope: deleteMany, findUnique, create use current user id', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.trackSubgenre.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.subgenre.findUnique.mockResolvedValue(
        makePrismaSubgenreRow({ name: 'indie' }),
      );
      prismaMock.trackSubgenre.create.mockResolvedValue({} as never);

      await repo.upsertTrackSubgenres(trackId, ['Indie']);

      expect(prismaMock.trackSubgenre.deleteMany).toHaveBeenCalledWith({
        where: { trackId: TRACK_DB_ID, createdById: TEST_USER_ID },
      });
      expect(prismaMock.subgenre.findUnique).toHaveBeenCalledWith({
        where: { name: 'indie', createdById: TEST_USER_ID },
      });
      expect(prismaMock.trackSubgenre.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ createdById: TEST_USER_ID }),
      });
    });
  });

  describe('upsertAiAtmosphereTags', () => {
    it('optimal: deletes existing track atmosphere tags, finds or creates tags, creates track-tag links', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      const tags = ['Chill', 'Energetic'];
      prismaMock.trackAiAtmosphereTag.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.aiAtmosphereTag.findFirst
        .mockResolvedValueOnce({
          id: 'tag-1',
          name: 'chill',
          description: null,
          createdAt: new Date(),
          createdById: TEST_USER_ID,
          updatedAt: null,
          updatedById: null,
        })
        .mockResolvedValueOnce(null);
      prismaMock.aiAtmosphereTag.create.mockResolvedValue({
        id: 'tag-2',
        name: 'energetic',
        description: null,
        createdAt: new Date(),
        createdById: TEST_USER_ID,
        updatedAt: null,
        updatedById: null,
      });
      prismaMock.trackAiAtmosphereTag.create.mockResolvedValue({} as never);

      await repo.upsertAiAtmosphereTags(trackId, tags);

      expect(prismaMock.trackAiAtmosphereTag.deleteMany).toHaveBeenCalledWith({
        where: {
          trackId: TRACK_DB_ID,
          createdById: TEST_USER_ID,
        },
      });
      expect(prismaMock.aiAtmosphereTag.findFirst).toHaveBeenCalledWith({
        where: { name: 'chill', createdById: TEST_USER_ID },
      });
      expect(prismaMock.aiAtmosphereTag.findFirst).toHaveBeenCalledWith({
        where: { name: 'energetic', createdById: TEST_USER_ID },
      });
      expect(prismaMock.aiAtmosphereTag.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.trackAiAtmosphereTag.create).toHaveBeenCalledTimes(2);
    });

    it('failure: rethrows when Prisma deleteMany throws', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.trackAiAtmosphereTag.deleteMany.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        repo.upsertAiAtmosphereTags(trackId, ['Chill']),
      ).rejects.toThrow('DB error');
    });

    it('createdById scope: deleteMany, findFirst, create use current user id', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.trackAiAtmosphereTag.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.aiAtmosphereTag.findFirst.mockResolvedValue({
        id: 'tag-1',
        name: 'chill',
        description: null,
        createdAt: new Date(),
        createdById: TEST_USER_ID,
        updatedAt: null,
        updatedById: null,
      });
      prismaMock.trackAiAtmosphereTag.create.mockResolvedValue({} as never);

      await repo.upsertAiAtmosphereTags(trackId, ['Chill']);

      expect(prismaMock.trackAiAtmosphereTag.deleteMany).toHaveBeenCalledWith({
        where: { trackId: TRACK_DB_ID, createdById: TEST_USER_ID },
      });
      expect(prismaMock.aiAtmosphereTag.findFirst).toHaveBeenCalledWith({
        where: { name: 'chill', createdById: TEST_USER_ID },
      });
      expect(prismaMock.trackAiAtmosphereTag.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          trackId: TRACK_DB_ID,
          createdById: TEST_USER_ID,
        }),
      });
    });

    it('optimal: skips empty or whitespace-only tag names', async () => {
      const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;
      prismaMock.trackAiAtmosphereTag.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.aiAtmosphereTag.findFirst.mockResolvedValue({
        id: 'tag-1',
        name: 'valid',
        description: null,
        createdAt: new Date(),
        createdById: TEST_USER_ID,
        updatedAt: null,
        updatedById: null,
      });
      prismaMock.trackAiAtmosphereTag.create.mockResolvedValue({} as never);

      await repo.upsertAiAtmosphereTags(trackId, ['', '  ', 'Valid']);

      expect(prismaMock.aiAtmosphereTag.findFirst).toHaveBeenCalledTimes(1);
      expect(prismaMock.aiAtmosphereTag.findFirst).toHaveBeenCalledWith({
        where: { name: 'valid', createdById: TEST_USER_ID },
      });
      expect(prismaMock.trackAiAtmosphereTag.create).toHaveBeenCalledTimes(1);
    });
  });
});
