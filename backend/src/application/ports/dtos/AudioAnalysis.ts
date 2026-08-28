// Simplified File Information
interface FileInfo {
  filename: string;
  filepath: string;
  file_extension: string;
  mime_type: string;
  file_size_bytes: number;
  file_size_mb: number;
  created_at: string;
  modified_at: string;
  accessed_at: string;
}

// Simplified Audio Technical Information
interface AudioTechnical {
  sample_rate: number;
  duration_seconds: number;
  format: string;
  bitrate: number;
  channels: number;
  samples: number;
  bit_depth: number;
  subtype: string;
}

// Simplified ID3 Tags
interface Id3Tags {
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
interface AggregationStatistics {
  mean: number;
  std: number;
  median: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
}
// Simplified Audio Features
interface AudioFeatures {
  musical_features: {
    valence: number;
    mood_calculation: {
      mode_factor: number;
      mode_confidence: number;
      mode_weight: number;
      tempo_factor: number;
      energy_factor: number;
      brightness_factor: number;
      harmonic_factor: number;
      spectral_balance: number;
      beat_strength: number;
      syncopation: number;
    };
    valence_mood: string;
    arousal: number;
    arousal_mood: string;
    danceability: number;
    danceability_feeling: string;
    danceability_calculation: {
      rhythm_stability: number;
      bass_presence: number;
      tempo_regularity: number;
      tempo_appropriateness: number;
      energy_factor: number;
      syncopation: number;
      beat_strength: number;
    };
    acousticness: number;
    instrumentalness: number;
    speechiness: number;
    liveness: number;
    energy_comment: string;
    energy_keywords: string[];
    tempo: number;
    key: string;
    camelot_key: string;
  };
  spectral_features: {
    spectral_centroids: AggregationStatistics;
    spectral_bandwidths: AggregationStatistics;
    spectral_spreads: AggregationStatistics;
    spectral_flatnesses: AggregationStatistics;
    spectral_rolloffs: AggregationStatistics;
    zero_crossing_rate: AggregationStatistics;
    rms: AggregationStatistics;
    energy_by_band: number[];
    energy_ratios: number[];
    mfcc_mean: number[];
    mfcc_std?: number[];
    spectral_contrasts?: AggregationStatistics;
    dynamic_range?: number;
    bass_presence?: number;
  };
  rhythm_fingerprint: {
    zcr_mean: number;
    zcr_std: number;
    onset_density?: number;
  };
  melodic_fingerprint: {
    chroma: {
      mean: number[];
      std: number[];
      max: number[];
      overall_mean: number;
      overall_std: number;
      dominant_pitch: number;
    };
    tonnetz: {
      mean: number[];
      std: number[];
      max: number[];
      overall_mean: number;
      overall_std: number;
    };
  };
}

// Simplified Audio Fingerprint
interface AudioFingerprint {
  file_hash: string;
  audio_hash: string;
  method: string;
}

// Simplified Genre Classification Details
interface GenreDetails {
  file_path: string;
  predicted_genre: string;
  confidence: number;
  all_probabilities: Record<string, number>;
  model_name: string;
}

// Simplified Classification Details
interface ClassificationDetails {
  genre_details: GenreDetails;
  subgenre_details: GenreDetails;
  specialist_used: string;
  processing_steps: string[];
}

// Simplified Hierarchical Classification
export interface HierarchicalClassification {
  success: boolean;
  classification: {
    genre: string;
    subgenre: string;
    confidence: {
      genre: number;
      subgenre: number;
      combined: number;
    };
  };
  aggregation_method: string;
  segment_count: number;
  genre_votes: Record<string, number>;
  subgenre_votes: Record<string, number>;
  processing_time: number;
  timestamp: number;
  model_name: string;
  file_path: string;
  segmentation: {
    used: boolean;
    segment_count: number;
    segment_duration: number;
    aggregation_method: string;
  };
  details: ClassificationDetails;
  musicbrainz_validation: {
    enabled: boolean;
    used: false;
    genres_found: [];
    genre_match: false;
    boost_factor: number;
    confidence_improvement: {
      genre: number;
      subgenre: number;
      combined: number;
    };
    message: string;
  };
  discogs_validation: {
    enabled: boolean;
    used: false;
    genres_found: [];
    genre_match: false;
    boost_factor: number;
    confidence_improvement: {
      genre: number;
      subgenre: number;
      combined: number;
    };
    message: string;
    subgenres_found: [];
  };
}

// Simplified Album Art
interface AlbumArt {
  source: string;
  imagePath: string;
  imageUrl: string;
}
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
  genres?: { genre: string; style: string; confidence: number }[];
  /** Top 5 instrument predictions above 10% confidence, from mtg_jamendo_instrument. */
  instruments?: { instrument: string; confidence: number }[];
  /** Top 5 tag predictions above 10% confidence, from mtg_jamendo_top50tags. */
  tags?: { tag: string; confidence: number }[];
}

export interface DiscogsTempo {
  /** Global tempo estimate in BPM, from TempoCNN. */
  tempo?: number;
  /** Mean per-window local tempo probability, as a confidence measure. */
  confidence?: number;
}

// Simplified Audio Analysis Response
export interface AudioAnalysisResponse {
  status: 'success' | 'error';
  message?: string;
  processing_time: number;
  processing_mode: string;
  features: AudioFeatures;
  fingerprint: AudioFingerprint;
  /** 1280-dim discogs-effnet embedding (Essentia); empty when extraction failed/unavailable. */
  embedding?: number[];
  /** Discogs-effnet classifier heads run on `embedding`; absent when disabled or extraction failed. */
  discogs_classifiers?: DiscogsClassifiers;
  /** TempoCNN tempo estimate (separate pipeline, not built on `embedding`); absent when disabled or extraction failed. */
  discogs_tempo?: DiscogsTempo;
  hierarchical_classification: HierarchicalClassification;
  album_art: AlbumArt;
  file_info: FileInfo;
  audio_technical: AudioTechnical;
  id3_tags: Id3Tags;
  ai_metadata?: AIMetadataResponse['metadata'];
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
// AI Metadata Response
export interface AIMetadataResponse {
  status: 'success' | 'partial' | 'error';
  message: string;
  filename: string;
  metadata: {
    artist: string;
    title: string;
    mix?: string | null;
    year?: string | number | null;
    country?: string | null;
    label?: string | null;
    genre: string[];
    style: string[];
    audioFeatures?: {
      bpm?: number | null;
      key?: string | null;
      vocals?: string | null;
      atmosphere?: string[] | null;
    } | null;
    context?: {
      background?: string | null;
      impact?: string | null;
    } | null;
    description?: string | null;
    tags: string[];
  };
  processingTime?: number;
  serviceInstance?: string;
}
