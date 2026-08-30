import { MusicTrackId } from 'src/kernel/ids';

export type AudioFeatures = {
  trackId: MusicTrackId;
  tempo?: { min: number; max: number };
  /** Center BPM for soft tempo scoring; typically `(tempo.min + tempo.max) / 2`. */
  tempoCenter?: number;
  key?: string;
  camelotKey?: string;
  valence?: number;
  valenceMood?: string;
  arousal?: number;
  arousalMood?: string;
  danceability?: number;
  danceabilityFeeling?: string;
  instrumentalness?: number;
  voice?: number;
  moodHappy?: number;
  moodSad?: number;
  moodRelaxed?: number;
  moodAggressive?: number;
  moodParty?: number;
  genres?: string[];
  subgenres?: string[];
  artist?: string;
  album?: string;
  /**
   * Element-wise mean of the seed tracks' 1280-dim discogs-effnet embeddings.
   * Kept for backward compatibility, single-seed fallback, and reason generation.
   */
  embedding?: number[];
  /**
   * Per-seed 1280-dim discogs-effnet embeddings (one entry per seed track that has
   * a vector, capped at 10). Drives a native multi-`knn` search so a candidate close
   * to any single sub-cluster of a diverse playlist still ranks well, instead of
   * being matched against a blurred centroid.
   */
  embeddings?: number[][];
};
