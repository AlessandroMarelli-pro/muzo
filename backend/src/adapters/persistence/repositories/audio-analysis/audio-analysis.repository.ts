import { Injectable, Inject } from '@nestjs/common';
import { AudioAnalysisResponse } from 'src/application/ports/dtos/AudioAnalysis';
import { IAudioAnalysisRepository } from 'src/application/ports/repositories/IAudioAnalysisRepository';
import {
  PRISMA_SERVICE,
  PrismaService,
} from 'src/infrastructure/database/prisma.service';
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
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
  ) {}

  async upsertAudioFingerprint(
    trackId: MusicTrackId,
    analysisResult: AudioAnalysisResponse,
  ): Promise<void> {
    const features = analysisResult.features;
    const melodicFingerprint = features?.melodic_fingerprint;
    const spectralFeatures = features?.spectral_features;
    const musicalFeatures = features?.musical_features;
    const fingerprint = analysisResult.fingerprint;
    const fingerprintData = {
      mfcc: JSON.stringify(spectralFeatures?.mfcc_mean || []),
      spectralCentroid: JSON.stringify(
        spectralFeatures?.spectral_centroids || {},
      ),
      spectralRolloff: JSON.stringify(
        spectralFeatures?.spectral_rolloffs || {},
      ),
      spectralContrast: JSON.stringify([]),
      chroma: JSON.stringify(melodicFingerprint?.chroma || {}),
      spectralSpread: JSON.stringify(spectralFeatures?.spectral_spreads || {}),
      spectralBandwith: JSON.stringify(
        spectralFeatures?.spectral_bandwidths || {},
      ),
      spectralFlatness: JSON.stringify(
        spectralFeatures?.spectral_flatnesses || {},
      ),
      zeroCrossingRate: JSON.stringify(
        spectralFeatures?.zero_crossing_rate || {},
      ),
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
      rhythmStability:
        musicalFeatures?.danceability_calculation?.rhythm_stability || 0,
      bassPresence:
        musicalFeatures?.danceability_calculation?.bass_presence || 0,
      tempoRegularity:
        musicalFeatures?.danceability_calculation?.tempo_regularity || 0,
      tempoAppropriateness:
        musicalFeatures?.danceability_calculation?.tempo_appropriateness || 0,
      energyFactor:
        musicalFeatures?.danceability_calculation?.energy_factor || 0,
      syncopation: musicalFeatures?.danceability_calculation?.syncopation || 0,
      modeFactor: musicalFeatures?.mood_calculation?.mode_factor || 0,
      modeConfidence: musicalFeatures?.mood_calculation?.mode_confidence || 0,
      modeWeight: musicalFeatures?.mood_calculation?.mode_weight || 0,
      tempoFactor: musicalFeatures?.mood_calculation?.tempo_factor || 0,
      brightnessFactor:
        musicalFeatures?.mood_calculation?.brightness_factor || 0,
      trackId: extractModelId(trackId).dbId,
    };
    await this.prisma.audioFingerprint.upsert({
      where: {
        trackId: fingerprintData.trackId,
        createdById: getCurrentUserId(),
      },
      update: fingerprintData,
      create: fingerprintData,
    });
  }

  async upsertTrackGenres(
    trackId: MusicTrackId,
    genres: string[],
  ): Promise<void> {
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

  async upsertTrackSubgenres(
    trackId: MusicTrackId,
    subgenres: string[],
  ): Promise<void> {
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

  async upsertAiAtmosphereTags(
    trackId: MusicTrackId,
    tags: string[],
  ): Promise<void> {
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
