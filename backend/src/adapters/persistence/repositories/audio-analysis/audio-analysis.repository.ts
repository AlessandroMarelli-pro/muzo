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

  /**
   * Reads a genre by its unique `name`, creating it if absent. Race-safe: if a
   * concurrent transaction inserts the same name between our read and create,
   * Prisma raises P2002 on `genres_name_key` and we re-read instead of failing
   * the whole analysis. Rows are normally seeded (see the
   * seed_discogs_genre_taxonomy migration), so the create path is a fallback.
   */
  private async findOrCreateGenreByName(name: string) {
    const existing = await this.prisma.genre.findUnique({ where: { name } });
    if (existing) return existing;
    try {
      return await this.prisma.genre.create({
        data: toPrismaGenre(models.genre.instantiateNew({ name, description: null })),
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const row = await this.prisma.genre.findUnique({ where: { name } });
      if (!row) throw error;
      return row;
    }
  }

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
    const linkedGenreIds = new Set<string>();
    const linkedSubgenreIds = new Set<string>();

    for (const { genre: genreName, confidence } of classifications.genres ?? []) {
      if (!genreName || genreName.trim() === '') continue;
      const normalizedName = genreName.trim().toLowerCase();

      // The Discogs taxonomy is seeded (see the seed_discogs_genre_taxonomy
      // migration), so this is normally a plain read. The create covers a label
      // the classifier emits that predates the seed; the P2002 catch handles the
      // race when concurrent analyses create the same name (Prisma has no atomic
      // upsert on a non-PK unique -- genres_name_key).
      const genre = await this.findOrCreateGenreByName(normalizedName);
      genreIdByName.set(normalizedName, genre.id);

      // The trackGenre/trackSubgenre rows for this track were just deleted above,
      // so a plain create is enough. classifications.genres can still repeat a
      // normalized name (e.g. "House" + "house"); skip the duplicate.
      if (linkedGenreIds.has(genre.id)) continue;
      linkedGenreIds.add(genre.id);
      const trackGenre = toPrismaTrackGenre(
        models.trackGenre.instantiateNew({
          trackId,
          genreId: models.genre.id(genre.id),
          confidence,
        }),
      );
      await this.prisma.trackGenre.create({ data: trackGenre });
    }

    for (const { style: styleName, genre: parentGenreName, confidence } of classifications.styles ??
      []) {
      if (!styleName || styleName.trim() === '') continue;
      const normalizedName = styleName.trim().toLowerCase();
      const parentGenreId = parentGenreName
        ? (genreIdByName.get(parentGenreName.trim().toLowerCase()) ?? null)
        : null;

      // Seeded from the Discogs taxonomy; see the genre note above for why this
      // is findOrCreate rather than upsert (subgenres_name_key). A newly created
      // row gets the parent genre we just saw; an existing row whose parent
      // differs is realigned to it.
      let subgenre = await this.prisma.subgenre.findUnique({ where: { name: normalizedName } });
      if (!subgenre) {
        try {
          subgenre = await this.prisma.subgenre.create({
            data: toPrismaSubgenre(
              models.subgenre.instantiateNew({
                name: normalizedName,
                description: null,
                genreId: parentGenreId ? models.genre.id(parentGenreId) : null,
              }),
            ),
          });
        } catch (error) {
          if ((error as { code?: string }).code !== 'P2002') throw error;
          subgenre = await this.prisma.subgenre.findUnique({ where: { name: normalizedName } });
          if (!subgenre) throw error;
        }
      } else if (parentGenreId && subgenre.genreId !== parentGenreId) {
        subgenre = await this.prisma.subgenre.update({
          where: { id: subgenre.id },
          data: { genreId: parentGenreId },
        });
      }

      // Plain create -- see the trackGenre note above. Skip a style that
      // normalizes to one already linked for this track.
      if (linkedSubgenreIds.has(subgenre.id)) continue;
      linkedSubgenreIds.add(subgenre.id);
      const trackSubgenre = toPrismaTrackSubgenre(
        models.trackSubgenre.instantiateNew({
          trackId,
          subgenreId: models.subgenre.id(subgenre.id),
          confidence,
        }),
      );
      await this.prisma.trackSubgenre.create({ data: trackSubgenre });
    }
  }
}
