import type { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import type { RecommendationWeights } from 'src/kernel/types/model-types';

/** Elasticsearch gauss decay requires scale strictly greater than 0. */
export function ensurePositiveGaussScale(scale: number, fallback: number): number {
  const fb = Number.isFinite(fallback) && fallback > 0 ? fallback : 1e-6;
  const raw = Number.isFinite(scale) && scale > 0 ? scale : fb;
  return Math.max(raw, 1e-6);
}

export function tempoOriginAndScale(playlistFeatures: {
  tempo?: { min: number; max: number };
  tempoCenter?: number;
}): { origin: number; scale: number } {
  const { tempo, tempoCenter } = playlistFeatures;
  if (tempoCenter != null && Number.isFinite(tempoCenter) && tempoCenter > 0) {
    return { origin: tempoCenter, scale: 18 };
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

export type FunctionScoreFunction = Record<string, unknown>;

/**
 * All boost weights below are fractions of the embedding base (whose weight
 * is fixed at 1.0 in the query builder) -- see defaults.ts
 * DEFAULT_RECOMMENDATION_WEIGHTS for the default budget. Every boost here is
 * bounded by construction (`filter` + fixed `weight`, or `gauss` which is
 * itself in [0,1]) -- never a raw `term`/`terms_set` score, which is
 * unbounded IDF-weighted (measured up to ~4.2 on this corpus) and would
 * swamp a base capped at 1.0.
 */

function gaussFunction(
  field: string,
  origin: number,
  scale: number,
  weight: number,
): FunctionScoreFunction {
  return {
    gauss: {
      [field]: {
        origin,
        scale: ensurePositiveGaussScale(scale, 0.18),
        offset: 0.04,
        decay: 0.5,
      },
    },
    weight,
  };
}

function termFunction(field: string, value: string, weight: number): FunctionScoreFunction {
  return { filter: { term: { [field]: value } }, weight };
}

export function tempoFunction(
  playlistFeatures: { tempo?: { min: number; max: number }; tempoCenter?: number },
  weight: number,
): FunctionScoreFunction | undefined {
  if (weight <= 0) {
    return undefined;
  }
  const { origin, scale } = tempoOriginAndScale(playlistFeatures);
  return gaussFunction(
    'musical_audio_features.tempo',
    Number.isFinite(origin) ? origin : 120,
    scale,
    weight,
  );
}

export function genreFunctions(
  playlistFeatures: AudioFeatures,
  weight: number,
): FunctionScoreFunction[] {
  if (weight <= 0) {
    return [];
  }
  const genres = playlistFeatures.genres ?? [];
  const subgenres = playlistFeatures.subgenres ?? [];
  const total = genres.length + subgenres.length;
  if (total === 0) {
    return [];
  }
  // Split the budget evenly across every genre+subgenre term so the total
  // genre contribution stays bounded by `weight` regardless of how many
  // terms match, instead of each term adding its own full weight.
  const perTerm = weight / total;
  return [
    ...genres.map((genre) => termFunction('genres', genre, perTerm)),
    ...subgenres.map((subgenre) => termFunction('subgenres', subgenre, perTerm)),
  ];
}

export function moodFunctions(
  playlistFeatures: AudioFeatures,
  weight: number,
): FunctionScoreFunction[] {
  if (weight <= 0) {
    return [];
  }
  const moods: [string, number | undefined][] = [
    ['mood_happy', playlistFeatures.moodHappy],
    ['mood_sad', playlistFeatures.moodSad],
    ['mood_relaxed', playlistFeatures.moodRelaxed],
    ['mood_aggressive', playlistFeatures.moodAggressive],
    ['mood_party', playlistFeatures.moodParty],
  ];
  const present = moods.filter(([, v]) => v != null && Number.isFinite(v));
  if (present.length === 0) {
    return [];
  }
  // Shared budget across the 5 (correlated) mood dims, not 5 independent
  // weights -- otherwise a track that happens to align on all five would
  // get 5x the intended mood influence.
  const perMood = weight / present.length;
  return present.map(([field, value]) =>
    gaussFunction(`musical_audio_features.${field}`, value as number, 0.18, perMood),
  );
}

export function scalarFunction(
  field: string,
  value: number | undefined,
  weight: number,
): FunctionScoreFunction | undefined {
  if (weight <= 0 || value == null || !Number.isFinite(value)) {
    return undefined;
  }
  return gaussFunction(`musical_audio_features.${field}`, value, 0.18, weight);
}

/**
 * `instrumentalness = 1 - voice` exactly (ai-service simple_feature_extractor.py).
 * They are perfectly anti-correlated -- scoring both as independent gauss
 * functions would double-count the same underlying axis. Both weights stay
 * as separate, independently tunable knobs in RecommendationWeights, but are
 * summed onto a single `voice` gauss function here (converting an
 * instrumentalness-only origin via `1 - instrumentalness` when voice itself
 * is absent).
 */
export function voiceFunction(
  playlistFeatures: AudioFeatures,
  weights: Pick<RecommendationWeights, 'voiceSimilarity' | 'instrumentalnessSimilarity'>,
): FunctionScoreFunction | undefined {
  const weight = (weights.voiceSimilarity ?? 0) + (weights.instrumentalnessSimilarity ?? 0);
  if (weight <= 0) {
    return undefined;
  }
  const origin =
    playlistFeatures.voice != null && Number.isFinite(playlistFeatures.voice)
      ? playlistFeatures.voice
      : playlistFeatures.instrumentalness != null &&
          Number.isFinite(playlistFeatures.instrumentalness)
        ? 1 - playlistFeatures.instrumentalness
        : undefined;
  if (origin == null) {
    return undefined;
  }
  return gaussFunction('musical_audio_features.voice', origin, 0.18, weight);
}

/**
 * One bounded `term` function per seed instrument, weighted by that
 * instrument's confidence share among the seeds (shares sum to ~1, see
 * calculate-features.ts aggregateSeedInstruments) so the total instrument
 * contribution is bounded by `weight` and the playlist's dominant instrument
 * counts for more than an incidental one.
 */
export function instrumentFunctions(
  playlistFeatures: AudioFeatures,
  weight: number,
): FunctionScoreFunction[] {
  if (weight <= 0) {
    return [];
  }
  return (playlistFeatures.instruments ?? [])
    .filter((i) => i.weight > 0)
    .map((i) => termFunction('instruments', i.instrument, weight * i.weight));
}

export function categoricalMoodFunctions(
  playlistFeatures: AudioFeatures,
  weight: number,
): FunctionScoreFunction[] {
  if (weight <= 0) {
    return [];
  }
  const functions: FunctionScoreFunction[] = [];
  if (playlistFeatures.valenceMood) {
    functions.push(
      termFunction('musical_audio_features.valence_mood', playlistFeatures.valenceMood, weight),
    );
  }
  if (playlistFeatures.arousalMood) {
    functions.push(
      termFunction('musical_audio_features.arousal_mood', playlistFeatures.arousalMood, weight),
    );
  }
  if (playlistFeatures.danceabilityFeeling) {
    functions.push(
      termFunction(
        'musical_audio_features.danceability_feeling',
        playlistFeatures.danceabilityFeeling,
        weight,
      ),
    );
  }
  return functions;
}
