import type { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';

/**
 * Port of extractReasonsFromElasticsearch (elasticsearch/helpers/extract-reason.ts,
 * now deleted). None of this ever depended on Elasticsearch's highlighting engine --
 * every reason is a direct comparison between the candidate row's stored features and
 * the aggregated seed AudioFeatures, so this is a straight one-to-one port. The dead
 * `energy_keywords` branch (referenced a field that never existed in the ES mapping)
 * is dropped.
 */
export type RecommendationCandidateRow = {
  camelotKey?: string | null;
  tempo?: number | null;
  valence?: number | null;
  valenceMood?: string | null;
  arousal?: number | null;
  arousalMood?: string | null;
  danceability?: number | null;
  danceabilityFeeling?: string | null;
  genres: string[];
  subgenres: string[];
};

export function extractRecommendationReasons(
  row: RecommendationCandidateRow,
  playlistFeatures: AudioFeatures,
): string[] {
  const reasons: string[] = [];

  if (row.camelotKey && playlistFeatures.camelotKey && row.camelotKey === playlistFeatures.camelotKey) {
    reasons.push(`Harmonic key match: ${row.camelotKey}`);
  }

  if (row.tempo != null && playlistFeatures.tempo != null) {
    const seedCenter =
      playlistFeatures.tempoCenter != null && Number.isFinite(playlistFeatures.tempoCenter)
        ? playlistFeatures.tempoCenter
        : (playlistFeatures.tempo.min + playlistFeatures.tempo.max) / 2;
    const diffExact = Math.abs(row.tempo - seedCenter);
    const secondaryBpm = seedCenter > 120 ? seedCenter / 2 : seedCenter * 2;
    const diffHalfDouble = Math.abs(row.tempo - secondaryBpm);
    const threshold = 12;
    if (diffExact <= threshold) {
      reasons.push(`Similar tempo: ${Math.round(seedCenter)} BPM`);
    } else if (diffHalfDouble <= threshold) {
      reasons.push(
        `Similar tempo (${seedCenter > 120 ? 'half-time' : 'double-time'}): ${Math.round(seedCenter)} BPM`,
      );
    }
  }

  if (row.valence != null && playlistFeatures.valence != null) {
    if (Math.abs(row.valence - playlistFeatures.valence) <= 0.1) {
      reasons.push(`Similar mood: ${row.valenceMood || 'matching valence'}`);
    }
  }

  if (row.arousal != null && playlistFeatures.arousal != null) {
    if (Math.abs(row.arousal - playlistFeatures.arousal) <= 0.1) {
      reasons.push(`Similar intensity: ${row.arousalMood || 'matching arousal'}`);
    }
  }

  if (row.danceability != null && playlistFeatures.danceability != null) {
    if (Math.abs(row.danceability - playlistFeatures.danceability) <= 0.1) {
      reasons.push(`Similar danceability: ${row.danceabilityFeeling || 'matching groove'}`);
    }
  }

  const genres = playlistFeatures.genres ?? [];
  if (genres.length > 0 && row.genres.length > 0) {
    const matching = genres.filter((g) => row.genres.includes(g));
    if (matching.length > 0) {
      reasons.push(`Same genre${matching.length > 1 ? 's' : ''}: ${matching.slice(0, 3).join(', ')}`);
    }
  }

  const subgenres = playlistFeatures.subgenres ?? [];
  if (subgenres.length > 0 && row.subgenres.length > 0) {
    const matching = subgenres.filter((s) => row.subgenres.includes(s));
    if (matching.length > 0) {
      reasons.push(
        `Same subgenre${matching.length > 1 ? 's' : ''}: ${matching.slice(0, 3).join(', ')}`,
      );
    }
  }

  return reasons;
}
