import { Inject, Injectable } from '@nestjs/common';
import {
  AnalysisClassifications,
  AudioAnalysisResponse,
  DiscogsClassifiers,
  DiscogsTempo,
} from 'src/application/ports/dtos/AudioAnalysis';
import { IAudioAnalysisRepository } from 'src/application/ports/repositories/IAudioAnalysisRepository';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { extractModelId, MusicTrackId } from 'src/kernel/ids';
import { getCurrentUserId, models } from 'src/kernel/types';
import {
  toPrismaGenre,
  toPrismaSubgenre,
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
    const features = analysisResult.features ?? {};
    const labels = analysisResult.labels ?? {};
    const classifications = analysisResult.classifications;
    const embedding = analysisResult.embedding;

    const fingerprintData = {
      tempo: features.tempo?.value ?? null,
      tempoConfidence: features.tempo?.confidence ?? null,
      key: features.key?.value ?? null,
      camelotKey: features.camelot_key?.value ?? null,
      mode: features.mode?.value ?? null,
      valence: features.valence?.value ?? null,
      arousal: features.arousal?.value ?? null,
      danceability: features.danceability?.value ?? null,
      instrumentalness: features.instrumentalness?.value ?? null,
      moodHappy: features.mood_happy?.value ?? null,
      moodSad: features.mood_sad?.value ?? null,
      moodRelaxed: features.mood_relaxed?.value ?? null,
      moodAggressive: features.mood_aggressive?.value ?? null,
      moodParty: features.mood_party?.value ?? null,
      voice: features.voice?.value ?? null,

      valenceMood: labels.valence_mood ?? null,
      arousalMood: labels.arousal_mood ?? null,
      danceabilityFeeling: labels.danceability_feeling ?? null,

      instruments: JSON.stringify(classifications?.instruments ?? []),
      tags: JSON.stringify(classifications?.tags ?? []),

      embedding: JSON.stringify(embedding?.vector ?? []),
      embeddingDim: embedding?.dim ?? null,

      schemaVersion: analysisResult.schema_version ?? 2,
      warnings: JSON.stringify(analysisResult.warnings ?? []),
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
      data: {
        embedding: JSON.stringify(embedding),
        embeddingDim: embedding.length || null,
      },
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
        danceability: classifiers.danceable ?? null,
        moodAggressive: classifiers.mood_aggressive ?? null,
        moodHappy: classifiers.mood_happy ?? null,
        moodParty: classifiers.mood_party ?? null,
        moodRelaxed: classifiers.mood_relaxed ?? null,
        moodSad: classifiers.mood_sad ?? null,
        voice: classifiers.voice ?? null,
        instruments: JSON.stringify(classifiers.instruments ?? []),
        tags: JSON.stringify(classifiers.tags ?? []),
        ...(tempo && {
          tempo: tempo.tempo ?? null,
          tempoConfidence: tempo.confidence ?? null,
        }),
      },
    });
  }

  /**
   * Replaces a track's genre/subgenre associations from the Discogs
   * genre_discogs400 classifications: `classifications.genres` populates
   * Genre (with confidence), `classifications.styles` populates Subgenre
   * (with confidence), and each style's parent genre finally populates
   * `Subgenre.genreId`.
   */
  async upsertTrackGenresFromClassifications(
    trackId: MusicTrackId,
    classifications: AnalysisClassifications,
  ): Promise<void> {
    const trackDbId = extractModelId(trackId).dbId;
    const userId = getCurrentUserId();

    await this.prisma.trackGenre.deleteMany({
      where: { trackId: trackDbId, createdById: userId },
    });
    await this.prisma.trackSubgenre.deleteMany({
      where: { trackId: trackDbId, createdById: userId },
    });

    const genreIdByName = new Map<string, string>();

    for (const { genre: genreName, confidence } of classifications.genres ?? []) {
      if (!genreName || genreName.trim() === '') continue;
      const normalizedName = genreName.trim().toLowerCase();

      // `name` is the only unique constraint (genres_name_key); upsert atomically
      // to avoid a race when tracks sharing a genre are analyzed concurrently.
      const genre = await this.prisma.genre.upsert({
        where: { name: normalizedName },
        create: toPrismaGenre(
          models.genre.instantiateNew({ name: normalizedName, description: null }),
        ),
        update: {},
      });
      genreIdByName.set(normalizedName, genre.id);

      // Upsert on the compound key: classifications.genres can repeat a name
      // (e.g. "House" + "house") and the same track may be re-analyzed
      // concurrently -- either would make a second create() collide with
      // track_genres_trackId_genreId_key.
      const trackGenre = toPrismaTrackGenre(
        models.trackGenre.instantiateNew({
          trackId,
          genreId: models.genre.id(genre.id),
          confidence,
        }),
      );
      await this.prisma.trackGenre.upsert({
        where: {
          trackId_genreId: {
            trackId: trackGenre.trackId,
            genreId: trackGenre.genreId,
          },
        },
        create: trackGenre,
        update: { confidence: trackGenre.confidence },
      });
    }

    for (const { style: styleName, genre: parentGenreName, confidence } of classifications.styles ??
      []) {
      if (!styleName || styleName.trim() === '') continue;
      const normalizedName = styleName.trim().toLowerCase();
      const parentGenreId = parentGenreName
        ? (genreIdByName.get(parentGenreName.trim().toLowerCase()) ?? null)
        : null;

      // `name` is the only unique constraint (subgenres_name_key); upsert atomically
      // to avoid a race when tracks sharing a style are analyzed concurrently.
      let subgenre = await this.prisma.subgenre.upsert({
        where: { name: normalizedName },
        create: toPrismaSubgenre(
          models.subgenre.instantiateNew({
            name: normalizedName,
            description: null,
            genreId: parentGenreId ? models.genre.id(parentGenreId) : null,
          }),
        ),
        update: {},
      });
      if (parentGenreId && subgenre.genreId !== parentGenreId) {
        subgenre = await this.prisma.subgenre.update({
          where: { id: subgenre.id },
          data: { genreId: parentGenreId },
        });
      }

      // Upsert on the compound key -- see the trackGenre note above.
      const trackSubgenre = toPrismaTrackSubgenre(
        models.trackSubgenre.instantiateNew({
          trackId,
          subgenreId: models.subgenre.id(subgenre.id),
          confidence,
        }),
      );
      await this.prisma.trackSubgenre.upsert({
        where: {
          trackId_subgenreId: {
            trackId: trackSubgenre.trackId,
            subgenreId: trackSubgenre.subgenreId,
          },
        },
        create: trackSubgenre,
        update: { confidence: trackSubgenre.confidence },
      });
    }
  }
}
