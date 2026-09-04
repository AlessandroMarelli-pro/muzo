import type { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import { extractModelId } from 'src/kernel/ids';
import type { RecommendationCriteria } from 'src/kernel/types/model-types';
import { Prisma } from '@prisma/client';

const EMBEDDING_DIM = 1280;

function isValidEmbeddingVector(vector: number[] | undefined): vector is number[] {
  return (
    Array.isArray(vector) &&
    vector.length === EMBEDDING_DIM &&
    vector.every((value) => Number.isFinite(value))
  );
}

/**
 * Same precedence as the Elasticsearch adapter this replaces: prefer per-seed
 * vectors (one per seed track, capped at 10, see calculate-features.ts) and
 * fall back to the single aggregated centroid embedding only when no per-seed
 * vectors survive validation.
 */
function seedEmbeddingVectors(playlistFeatures: AudioFeatures): number[][] {
  const perSeed = (playlistFeatures.embeddings ?? []).filter(isValidEmbeddingVector);
  if (perSeed.length > 0) {
    return perSeed;
  }
  return isValidEmbeddingVector(playlistFeatures.embedding) ? [playlistFeatures.embedding] : [];
}

/** pgvector literal input syntax, e.g. '[0.1,0.2,...]'. */
function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/**
 * ES `gauss` decay, ported verbatim: 1.0 within `offset` of `origin`, then a
 * Gaussian falloff reaching `decay` (0.5) at `distance === scale`. See
 * recommendation-scoring-functions.ts (now deleted) for the ES-side version
 * this must stay numerically identical to.
 */
function gaussScoreSql(fieldSql: Prisma.Sql, origin: number, scale: number, weight: number) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 0.18;
  return Prisma.sql`(${weight}::float8 * EXP(LN(0.5) * POWER(GREATEST(0, ABS(${fieldSql} - ${origin}::float8) - 0.04) / ${safeScale}::float8, 2)))`;
}

function termScoreSql(fieldSql: Prisma.Sql, value: string, weight: number) {
  return Prisma.sql`(CASE WHEN ${fieldSql} = ${value} THEN ${weight}::float8 ELSE 0 END)`;
}

function tempoOriginAndScale(playlistFeatures: {
  tempo?: { min: number; max: number };
  tempoCenter?: number;
}): { origin: number; scale: number } {
  const { tempo, tempoCenter } = playlistFeatures;
  if (tempoCenter != null && Number.isFinite(tempoCenter) && tempoCenter > 0) {
    return { origin: tempoCenter, scale: 5 };
  }
  if (
    tempo != null &&
    Number.isFinite(tempo.min) &&
    Number.isFinite(tempo.max) &&
    tempo.max > 0 &&
    tempo.min < Infinity
  ) {
    const origin = (tempo.min + tempo.max) / 2;
    const halfSpan = Math.max((tempo.max - tempo.min) / 2, 8);
    return { origin, scale: Math.min(halfSpan + 6, 40) };
  }
  return { origin: 120, scale: 25 };
}

export type RecommendationSqlQuery = {
  sql: Prisma.Sql;
  /** Whether the embedding base ran -- callers use this to decide result confidence. */
  usedEmbeddingBase: boolean;
};

/**
 * Builds the Postgres/pgvector equivalent of buildElasticsearchRecommendationQuery.
 *
 * The 1280-dim discogs-effnet embedding cosine similarity is ALWAYS the score
 * base, weight 1.0, remapped from pgvector's `<=>` cosine *distance* (range
 * [0,2]) to a [0,1] similarity via `(1 - distance + 1) / 2` so the scale
 * matches the boost weights below exactly as it did under Elasticsearch (see
 * DEFAULT_RECOMMENDATION_WEIGHTS in kernel/types/defaults.ts -- every boost
 * here is a bounded fraction of that 1.0 base). Every other signal is an
 * additive `CASE`/gaussian term summed on top, mirroring ES's
 * `score_mode: 'sum'`.
 *
 * Unlike the ES version, there's no `boost_mode: 'replace'` concern (no
 * separate "query relevance" score exists in a hand-written SQL SELECT to
 * leak in), no per-call-site Painless vector-caching bug to work around (a
 * plain SQL expression per seed vector is safe), and no "exists filter is
 * mandatory or the whole shard fails" hazard -- a NULL embedding column
 * simply needs a `WHERE ... IS NOT NULL` filter to exclude ungraded
 * candidates, which is what this does.
 */
export function buildRecommendationSql(
  playlistFeatures: AudioFeatures,
  criteria: RecommendationCriteria,
): RecommendationSqlQuery {
  const { weights } = criteria;
  const excluded = (criteria.excludeTrackIds ?? []).map((id) => extractModelId(id).dbId);
  const limit = criteria.limit ?? 50;

  const seedVectors = seedEmbeddingVectors(playlistFeatures);
  const usedEmbeddingBase =
    seedVectors.length > 0 && process.env.RECOMMENDATION_EMBEDDING_VECTOR_SIMILARITY !== 'false';

  const scoreTerms: Prisma.Sql[] = [];

  if (usedEmbeddingBase) {
    const strategy = criteria.seedStrategy ?? 'mean';
    const similarityExprs = seedVectors.map(
      (vector) =>
        Prisma.sql`(1 - (af."embeddingVector" <=> ${toVectorLiteral(vector)}::vector))`,
    );
    const combined =
      strategy === 'max'
        ? Prisma.sql`GREATEST(${Prisma.join(similarityExprs)})`
        : Prisma.sql`((${Prisma.join(similarityExprs, ' + ')}) / ${similarityExprs.length}::float8)`;
    // Remap cosine similarity [-1,1] to [0,1] to match the boost weight scale.
    scoreTerms.push(Prisma.sql`((${combined} + 1.0) / 2.0)`);
  }

  if (weights.genreSimilarity > 0) {
    const genres = playlistFeatures.genres ?? [];
    const subgenres = playlistFeatures.subgenres ?? [];
    const total = genres.length + subgenres.length;
    if (total > 0) {
      const perTerm = weights.genreSimilarity / total;
      for (const genre of genres) {
        scoreTerms.push(
          Prisma.sql`(CASE WHEN EXISTS (
            SELECT 1 FROM "track_genres" tg JOIN "genres" g ON g.id = tg."genreId"
            WHERE tg."trackId" = mt.id AND g.name = ${genre}
          ) THEN ${perTerm}::float8 ELSE 0 END)`,
        );
      }
      for (const subgenre of subgenres) {
        scoreTerms.push(
          Prisma.sql`(CASE WHEN EXISTS (
            SELECT 1 FROM "track_subgenres" tsg JOIN "subgenres" sg ON sg.id = tsg."subgenreId"
            WHERE tsg."trackId" = mt.id AND sg.name = ${subgenre}
          ) THEN ${perTerm}::float8 ELSE 0 END)`,
        );
      }
    }
  }

  if (weights.audioFeatures > 0) {
    const { origin, scale } = tempoOriginAndScale(playlistFeatures);
    scoreTerms.push(gaussScoreSql(Prisma.sql`af."tempo"`, origin, scale, weights.audioFeatures));
  }

  if (
    weights.arousalSimilarity > 0 &&
    playlistFeatures.arousal != null &&
    Number.isFinite(playlistFeatures.arousal)
  ) {
    scoreTerms.push(
      gaussScoreSql(Prisma.sql`af."arousal"`, playlistFeatures.arousal, 0.18, weights.arousalSimilarity),
    );
  }

  if (
    weights.danceabilitySimilarity > 0 &&
    playlistFeatures.danceability != null &&
    Number.isFinite(playlistFeatures.danceability)
  ) {
    scoreTerms.push(
      gaussScoreSql(
        Prisma.sql`af."danceability"`,
        playlistFeatures.danceability,
        0.18,
        weights.danceabilitySimilarity,
      ),
    );
  }

  if (weights.moodSimilarity > 0) {
    const moods: [Prisma.Sql, number | undefined][] = [
      [Prisma.sql`af."moodHappy"`, playlistFeatures.moodHappy],
      [Prisma.sql`af."moodSad"`, playlistFeatures.moodSad],
      [Prisma.sql`af."moodRelaxed"`, playlistFeatures.moodRelaxed],
      [Prisma.sql`af."moodAggressive"`, playlistFeatures.moodAggressive],
      [Prisma.sql`af."moodParty"`, playlistFeatures.moodParty],
    ];
    const present = moods.filter(([, v]) => v != null && Number.isFinite(v));
    if (present.length > 0) {
      const perMood = weights.moodSimilarity / present.length;
      for (const [field, value] of present) {
        scoreTerms.push(gaussScoreSql(field, value as number, 0.18, perMood));
      }
    }

    if (playlistFeatures.valenceMood) {
      scoreTerms.push(
        termScoreSql(Prisma.sql`af."valenceMood"`, playlistFeatures.valenceMood, weights.moodSimilarity),
      );
    }
    if (playlistFeatures.arousalMood) {
      scoreTerms.push(
        termScoreSql(Prisma.sql`af."arousalMood"`, playlistFeatures.arousalMood, weights.moodSimilarity),
      );
    }
    if (playlistFeatures.danceabilityFeeling) {
      scoreTerms.push(
        termScoreSql(
          Prisma.sql`af."danceabilityFeeling"`,
          playlistFeatures.danceabilityFeeling,
          weights.moodSimilarity,
        ),
      );
    }
  }

  const voiceWeight =
    (weights.voiceSimilarity ?? 0) + (weights.instrumentalnessSimilarity ?? 0);
  if (voiceWeight > 0) {
    const origin =
      playlistFeatures.voice != null && Number.isFinite(playlistFeatures.voice)
        ? playlistFeatures.voice
        : playlistFeatures.instrumentalness != null &&
            Number.isFinite(playlistFeatures.instrumentalness)
          ? 1 - playlistFeatures.instrumentalness
          : undefined;
    if (origin != null) {
      scoreTerms.push(gaussScoreSql(Prisma.sql`af."voice"`, origin, 0.18, voiceWeight));
    }
  }

  // Instruments are stored as a JSON array of {instrument, confidence} on
  // AudioFingerprint.instruments -- matched via a jsonb containment check
  // per seed instrument, same bounded-by-seed-share design as the ES terms.
  if (weights.instrumentsSimilarity > 0) {
    for (const instrument of playlistFeatures.instruments ?? []) {
      if (instrument.weight <= 0) continue;
      const perInstrumentWeight = weights.instrumentsSimilarity * instrument.weight;
      scoreTerms.push(
        Prisma.sql`(CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(af."instruments"::jsonb) elem
          WHERE elem->>'instrument' = ${instrument.instrument}
        ) THEN ${perInstrumentWeight}::float8 ELSE 0 END)`,
      );
    }
  }

  const scoreSql =
    scoreTerms.length > 0 ? Prisma.join(scoreTerms, ' + ') : Prisma.sql`0::float8`;

  const filters: Prisma.Sql[] = [];
  if (usedEmbeddingBase) {
    filters.push(Prisma.sql`af."embeddingVector" IS NOT NULL`);
  }
  if (excluded.length > 0) {
    filters.push(Prisma.sql`mt.id NOT IN (${Prisma.join(excluded)})`);
  }
  const whereSql =
    filters.length > 0 ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}` : Prisma.empty;

  const sql = Prisma.sql`
    SELECT
      mt.id AS "trackId",
      (${scoreSql}) AS "totalScore",
      af."camelotKey" AS "camelotKey",
      af."tempo" AS "tempo",
      af."valence" AS "valence",
      af."valenceMood" AS "valenceMood",
      af."arousal" AS "arousal",
      af."arousalMood" AS "arousalMood",
      af."danceability" AS "danceability",
      af."danceabilityFeeling" AS "danceabilityFeeling",
      COALESCE(
        (SELECT array_agg(g.name) FROM "track_genres" tg JOIN "genres" g ON g.id = tg."genreId" WHERE tg."trackId" = mt.id),
        ARRAY[]::text[]
      ) AS "genres",
      COALESCE(
        (SELECT array_agg(sg.name) FROM "track_subgenres" tsg JOIN "subgenres" sg ON sg.id = tsg."subgenreId" WHERE tsg."trackId" = mt.id),
        ARRAY[]::text[]
      ) AS "subgenres"
    FROM "music_tracks" mt
    JOIN "audio_fingerprints" af ON af."trackId" = mt.id
    ${whereSql}
    ORDER BY "totalScore" DESC
    LIMIT ${limit}
  `;

  return { sql, usedEmbeddingBase };
}
