// Simplified ID3 Tags
export interface Id3Tags {
  title?: string;
  artist?: string;
  album?: string;
  albumartist?: string;
  date?: string;
  year?: string;
  genre?: string;
  bpm?: string;
  track_number?: string;
  disc_number?: string;
  comment?: string;
  composer?: string;
  copyright?: string;
  bitrate?: number;
  filename_parsed?: boolean;
}

// Simplified Album Art
interface AlbumArt {
  source: string;
  imagePath: string;
  imageUrl: string;
}

// One `features.*` / `discogs_classifiers`-derived value: null when the source
// model was disabled, failed, or ran but produced nothing -- never a neutral
// placeholder (0.5 valence, 0.0 tempo, "Unknown" key).
export interface Feature<T = number> {
  value: T;
  confidence: number | null;
  source: string;
}

// `features` entries are omitted entirely (not present-but-null) when their
// source model produced nothing, hence every member here is optional.
export interface AnalysisFeatures {
  tempo?: Feature;
  key?: Feature<string>;
  camelot_key?: Feature<string>;
  mode?: Feature<string>;
  valence?: Feature;
  arousal?: Feature;
  danceability?: Feature;
  instrumentalness?: Feature;
  mood_happy?: Feature;
  mood_sad?: Feature;
  mood_relaxed?: Feature;
  mood_aggressive?: Feature;
  mood_party?: Feature;
  voice?: Feature;
}

// Interpreted tier labels; omitted when their source feature is null.
export interface AnalysisLabels {
  valence_mood?: string;
  arousal_mood?: string;
  danceability_feeling?: string;
}

export interface GenreStylePrediction {
  genre: string;
  style: string;
  confidence: number;
}

export interface AnalysisClassifications {
  /** The raw genre/style pairs from genre_discogs400, ranked by confidence. */
  genre_styles: GenreStylePrediction[];
  /** Aggregated per distinct genre, keeping the MAX confidence of that genre's pairs. */
  genres: { genre: string; confidence: number }[];
  /** One entry per pair, each carrying the genre it belongs to. */
  styles: { style: string; genre: string; confidence: number }[];
  instruments: { instrument: string; confidence: number }[];
  tags: { tag: string; confidence: number }[];
}

export interface AnalysisWarning {
  model: string;
  reason: 'disabled' | 'failed' | 'empty';
  detail: string | null;
}

/** Discogs-effnet classifier heads, as returned by the (unchanged) `/audio/embedding/discogs` endpoint. */
export interface DiscogsClassifiers {
  /** Probability of the "danceable" class (0-1). */
  danceable?: number;
  mood_aggressive?: number;
  mood_happy?: number;
  mood_party?: number;
  mood_relaxed?: number;
  mood_sad?: number;
  /** Probability of the "voice" class (0-1), from voice_instrumental. */
  voice?: number;
  /** Top 5 "Genre---Style" predictions above 10% confidence, from genre_discogs400. */
  genres?: GenreStylePrediction[];
  /** Top 5 instrument predictions above 10% confidence, from mtg_jamendo_instrument. */
  instruments?: { instrument: string; confidence: number }[];
  /** Top 5 tag predictions above 10% confidence, from mtg_jamendo_top50tags. */
  tags?: { tag: string; confidence: number }[];
}

/** Global tempo estimate, as returned by the (unchanged) `/audio/embedding/discogs` endpoint. */
export interface DiscogsTempo {
  tempo?: number;
  confidence?: number;
}

// Simple-analysis response envelope (schema_version 2), one entry per file in
// both the single and batch endpoints.
export interface AudioAnalysisResponse {
  status: 'success' | 'error';
  message?: string;
  processing_time: number;
  processing_mode: string;
  schema_version: number;
  track: {
    filename: string;
    extension: string;
    mime_type: string;
    size_bytes: number;
    size_mb: number;
  } | null;
  audio: {
    sample_rate: number;
    duration_s: number;
    format: string;
    bitrate: number;
    channels: number;
    samples: number;
    bit_depth: number;
    subtype: string;
  } | null;
  tags: Id3Tags | null;
  features: AnalysisFeatures;
  labels: AnalysisLabels;
  classifications: AnalysisClassifications;
  /** 1280-dim discogs-effnet embedding (Essentia); null when extraction failed/unavailable. */
  embedding: { vector: number[]; dim: number; source: string } | null;
  /** Names exactly which model produced nothing and why; empty when everything ran. */
  warnings: AnalysisWarning[];
  /** Route-added, single endpoint only. */
  album_art?: AlbumArt | null;
}

export interface AudioAnalysisBatchResponse {
  status: string;
  total_files: number;
  successful: number;
  failed: number;
  results: AudioAnalysisResponse[];
  processing_time: number;
  processing_mode: string;
}
