import { Inject, Injectable } from '@nestjs/common';
import {
  AudioAnalysisResponse,
  DiscogsClassifiers,
  DiscogsTempo,
} from 'src/application/ports/dtos/AudioAnalysis';
import { IAudioAnalysisRepository } from 'src/application/ports/repositories/IAudioAnalysisRepository';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { extractModelId, MusicTrackId } from 'src/kernel/ids';
import { getCurrentUserId, models } from 'src/kernel/types';
import {
  toPrismaAiAtmosphereTag,
  toPrismaGenre,
  toPrismaSubgenre,
  toPrismaTrackAiAtmosphereTag,
  toPrismaTrackGenre,
  toPrismaTrackSubgenre,
} from './audio-analysis.mapper';

@Injectable()
export class AudioAnalysisRepository implements IAudioAnalysisRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async upsertAudioFingerprint(
    trackId: MusicTrackId,
    analysisResult: AudioAnalysisResponse,
  ): Promise<void> {
    const features = analysisResult.features;
    const melodicFingerprint = features?.melodic_fingerprint;
    const spectralFeatures = features?.spectral_features;
    const musicalFeatures = features?.musical_features;
    const rhythmFingerprint = features?.rhythm_fingerprint;
    const fingerprint = analysisResult.fingerprint;
    const mfccMean = spectralFeatures?.mfcc_mean ?? [];
    const mfccStd = spectralFeatures?.mfcc_std ?? [];
    const mfccStored =
      Array.isArray(mfccStd) && mfccStd.length > 0
        ? JSON.stringify({ mean: mfccMean, std: mfccStd })
        : JSON.stringify(mfccMean);
    const mfccStdColumn =
      Array.isArray(mfccStd) && mfccStd.length === 13 ? JSON.stringify(mfccStd) : '[]';
    const fingerprintData = {
      mfcc: mfccStored,
      mfccStd: mfccStdColumn,
      spectralCentroid: JSON.stringify(spectralFeatures?.spectral_centroids || {}),
      spectralRolloff: JSON.stringify(spectralFeatures?.spectral_rolloffs || {}),
      spectralContrast: JSON.stringify(spectralFeatures?.spectral_contrasts || {}),
      chroma: JSON.stringify(melodicFingerprint?.chroma || {}),
      spectralSpread: JSON.stringify(spectralFeatures?.spectral_spreads || {}),
      spectralBandwith: JSON.stringify(spectralFeatures?.spectral_bandwidths || {}),
      spectralFlatness: JSON.stringify(spectralFeatures?.spectral_flatnesses || {}),
      zeroCrossingRate: JSON.stringify(spectralFeatures?.zero_crossing_rate || {}),
      rms: JSON.stringify(spectralFeatures?.rms || {}),
      energyByBand: JSON.stringify(spectralFeatures?.energy_by_band || []),
      energyComment: musicalFeatures?.energy_comment ?? '',
      energyKeywords: JSON.stringify(musicalFeatures?.energy_keywords ?? []),
      tempo: musicalFeatures?.tempo || 0,
      key: musicalFeatures?.key || '',

      valence: musicalFeatures?.valence || 0,
      danceability: musicalFeatures?.danceability || 0,
      arousal: musicalFeatures?.arousal || 0,
      acousticness: musicalFeatures?.acousticness || 0,
      instrumentalness: musicalFeatures?.instrumentalness || 0,
      speechiness: musicalFeatures?.speechiness || 0,
      liveness: musicalFeatures?.liveness || 0,
      audioHash: fingerprint.audio_hash || '',
      fileHash: fingerprint.file_hash || '',
      tonnetz: JSON.stringify(melodicFingerprint?.tonnetz || {}),
      camelotKey: musicalFeatures?.camelot_key || '',
      valenceMood: musicalFeatures?.valence_mood || '',
      arousalMood: musicalFeatures?.arousal_mood || '',
      danceabilityFeeling: musicalFeatures?.danceability_feeling || '',
      rhythmStability: musicalFeatures?.danceability_calculation?.rhythm_stability || 0,
      bassPresence: musicalFeatures?.danceability_calculation?.bass_presence || 0,
      tempoRegularity: musicalFeatures?.danceability_calculation?.tempo_regularity || 0,
      tempoAppropriateness: musicalFeatures?.danceability_calculation?.tempo_appropriateness || 0,
      energyFactor: musicalFeatures?.danceability_calculation?.energy_factor || 0,
      syncopation: musicalFeatures?.danceability_calculation?.syncopation || 0,
      modeFactor: musicalFeatures?.mood_calculation?.mode_factor || 0,
      modeConfidence: musicalFeatures?.mood_calculation?.mode_confidence || 0,
      modeWeight: musicalFeatures?.mood_calculation?.mode_weight || 0,
      tempoFactor: musicalFeatures?.mood_calculation?.tempo_factor || 0,
      brightnessFactor: musicalFeatures?.mood_calculation?.brightness_factor || 0,
      harmonicFactor: musicalFeatures?.mood_calculation?.harmonic_factor || 0,
      spectralBalance: musicalFeatures?.mood_calculation?.spectral_balance || 0,
      beatStrength: musicalFeatures?.mood_calculation?.beat_strength ?? 0,
      onsetDensity: rhythmFingerprint?.onset_density ?? 0,
      dynamicRange: spectralFeatures?.dynamic_range ?? 0,
      embedding: JSON.stringify(analysisResult.embedding ?? []),
      discogsDanceability: analysisResult.discogs_classifiers?.danceable ?? null,
      discogsMoodAggressive: analysisResult.discogs_classifiers?.mood_aggressive ?? null,
      discogsMoodHappy: analysisResult.discogs_classifiers?.mood_happy ?? null,
      discogsMoodParty: analysisResult.discogs_classifiers?.mood_party ?? null,
      discogsMoodRelaxed: analysisResult.discogs_classifiers?.mood_relaxed ?? null,
      discogsMoodSad: analysisResult.discogs_classifiers?.mood_sad ?? null,
      discogsGenres: JSON.stringify(analysisResult.discogs_classifiers?.genres ?? []),
      discogsVoice: analysisResult.discogs_classifiers?.voice ?? null,
      discogsInstruments: JSON.stringify(analysisResult.discogs_classifiers?.instruments ?? []),
      discogsTags: JSON.stringify(analysisResult.discogs_classifiers?.tags ?? []),
      discogsTempo: analysisResult.discogs_tempo?.tempo ?? null,
      discogsTempoConfidence: analysisResult.discogs_tempo?.confidence ?? null,
    };

    await this.prisma.audioFingerprint.upsert({
      where: {
        trackId: extractModelId(trackId).dbId,
        createdById: getCurrentUserId(),
      },
      update: fingerprintData,
      create: {
        ...fingerprintData,
        trackId: extractModelId(trackId).dbId,
        createdById: getCurrentUserId(),
      },
    });
  }

  async updateEmbedding(trackId: MusicTrackId, embedding: number[]): Promise<void> {
    await this.prisma.audioFingerprint.update({
      where: {
        trackId: extractModelId(trackId).dbId,
        createdById: getCurrentUserId(),
      },
      data: { embedding: JSON.stringify(embedding) },
    });
  }

  async updateDiscogsClassifiers(
    trackId: MusicTrackId,
    classifiers: DiscogsClassifiers,
    tempo?: DiscogsTempo,
  ): Promise<void> {
    await this.prisma.audioFingerprint.update({
      where: {
        trackId: extractModelId(trackId).dbId,
        createdById: getCurrentUserId(),
      },
      data: {
        discogsDanceability: classifiers.danceable ?? null,
        discogsMoodAggressive: classifiers.mood_aggressive ?? null,
        discogsMoodHappy: classifiers.mood_happy ?? null,
        discogsMoodParty: classifiers.mood_party ?? null,
        discogsMoodRelaxed: classifiers.mood_relaxed ?? null,
        discogsMoodSad: classifiers.mood_sad ?? null,
        discogsGenres: JSON.stringify(classifiers.genres ?? []),
        discogsVoice: classifiers.voice ?? null,
        discogsInstruments: JSON.stringify(classifiers.instruments ?? []),
        discogsTags: JSON.stringify(classifiers.tags ?? []),
        ...(tempo && {
          discogsTempo: tempo.tempo ?? null,
          discogsTempoConfidence: tempo.confidence ?? null,
        }),
      },
    });
  }

  async upsertTrackGenres(trackId: MusicTrackId, genres: string[]): Promise<void> {
    // Remove existing genre associations
    await this.prisma.trackGenre.deleteMany({
      where: {
        trackId: extractModelId(trackId).dbId,
        createdById: getCurrentUserId(),
      },
    });

    // Create or find genres and associate them
    for (const genreName of genres) {
      if (!genreName || genreName.trim() === '') continue;

      // Lowercase the genre name to ensure uniqueness
      const normalizedName = genreName.trim().toLowerCase();

      let genre = await this.prisma.genre.findUnique({
        where: { name: normalizedName, createdById: getCurrentUserId() },
      });
      if (!genre) {
        genre = await this.prisma.genre.create({
          data: toPrismaGenre(
            models.genre.instantiateNew({
              name: normalizedName,
              description: null,
            }),
          ),
        });
      }
      await this.prisma.trackGenre.create({
        data: toPrismaTrackGenre(
          models.trackGenre.instantiateNew({
            trackId,
            genreId: models.genre.id(genre.id),
          }),
        ),
      });
    }
  }

  async upsertTrackSubgenres(trackId: MusicTrackId, subgenres: string[]): Promise<void> {
    // Remove existing genre associations
    await this.prisma.trackSubgenre.deleteMany({
      where: {
        trackId: extractModelId(trackId).dbId,
        createdById: getCurrentUserId(),
      },
    });

    // Create or find genres and associate them
    for (const subgenreName of subgenres) {
      if (!subgenreName || subgenreName.trim() === '') continue;

      // Lowercase the genre name to ensure uniqueness
      const normalizedName = subgenreName.trim().toLowerCase();

      let subgenre = await this.prisma.subgenre.findUnique({
        where: { name: normalizedName, createdById: getCurrentUserId() },
      });

      if (!subgenre) {
        subgenre = await this.prisma.subgenre.create({
          data: toPrismaSubgenre(
            models.subgenre.instantiateNew({
              name: normalizedName,
              description: null,
              genreId: null,
            }),
          ),
        });
      }
      await this.prisma.trackSubgenre.create({
        data: toPrismaTrackSubgenre(
          models.trackSubgenre.instantiateNew({
            trackId,
            subgenreId: models.subgenre.id(subgenre.id),
          }),
        ),
      });
    }
  }

  async upsertAiAtmosphereTags(trackId: MusicTrackId, tags: string[]): Promise<void> {
    const trackDbId = extractModelId(trackId).dbId;
    const userId = getCurrentUserId();

    await this.prisma.trackAiAtmosphereTag.deleteMany({
      where: {
        trackId: trackDbId,
        createdById: userId,
      },
    });

    for (const tagName of tags) {
      if (!tagName || tagName.trim() === '') continue;

      const normalizedName = tagName.trim().toLowerCase();

      let tag = await this.prisma.aiAtmosphereTag.findFirst({
        where: { name: normalizedName, createdById: userId },
      });
      if (!tag) {
        tag = await this.prisma.aiAtmosphereTag.create({
          data: toPrismaAiAtmosphereTag(
            models.aiAtmosphereTag.instantiateNew({
              name: normalizedName,
            }),
          ),
        });
      }
      await this.prisma.trackAiAtmosphereTag.create({
        data: toPrismaTrackAiAtmosphereTag(
          models.trackAiAtmosphereTag.instantiateNew({
            trackId,
            aiAtmosphereTagId: models.aiAtmosphereTag.id(tag.id),
          }),
        ),
      });
    }
  }
}
