/**
 * AI Service Response Types
 *
 * TypeScript interfaces for the Muzo AI Service API responses
 */

// File Information
export interface FileInfo {
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

// Audio Technical Information
export interface AudioTechnical {
  sample_rate: number;
  channels: number;
  frames: number;
  duration_seconds: number;
  subtype: string;
  format: string;
  duration_minutes: number;
  estimated_bit_depth: number;
  estimated_bitrate_kbps: number;
  is_stereo: boolean;
  is_mono: boolean;
}

// Audio Content Analysis
export interface AudioContent {
  rms_energy: number;
  zero_crossing_rate: number;
  spectral_centroid: number;
  spectral_rolloff: number;
  spectral_bandwidth: number;
  tempo_bpm: number;
  estimated_key: string;
  harmonic_ratio: number;
  percussive_ratio: number;
  beat_count: number;
  beats_per_minute: number;
}

// ID3 Tags
export interface Id3Tags {
  title?: string;
  artist?: string;
  album?: string;
  albumartist?: string;
  date?: string;
  copyright?: string;
  track_number?: string;
  disc_number?: string;
  bitrate?: string;
  genre?: string;
  year?: string;
}

// Comprehensive Metadata
export interface AudioMetadata {
  file_info: FileInfo;
  audio_technical: AudioTechnical;
  audio_content: AudioContent;
  id3_tags: Id3Tags;
}

// Base response structure
export interface BaseAiResponse {
  filename: string;
  metadata: AudioMetadata;
  status: 'success' | 'error';
  error?: string;
  message?: string;
}

// Audio Features
export interface AudioFeatures {
  // MFCC features (26 coefficients in the actual response)
  mfcc: number[];

  // Zero crossing rate
  zero_crossing_rate: number;

  spectral_features: {
    // Spectral features (single values, not mean/std)
    spectral_centroid: number;
    spectral_rolloff: number;

    // Spectral contrast (7 values)
    spectral_contrast: number[];
  };

  // Chroma features (12 pitch classes)
  chroma: number[];

  // Tempo and rhythm
  tempo: number;

  // Additional musical features
  key: string;
  energy: number;
  valence: number;
  danceability: number;

  // File information
  file_path: string;
  duration: number;
  length: number;
  sample_rate: number;

  // Optional fields
  bitrate?: number;
  format?: string;
}

// Audio Fingerprint
export interface AudioFingerprint {
  // File hash for duplicate detection
  file_hash: string;
  audio_hash: string;

  // Spectral fingerprint
  spectral_fingerprint: {
    centroid_mean: number;
    centroid_std: number;
    rolloff_mean: number;
    rolloff_std: number;
    bandwidth_mean: number;
    bandwidth_std: number;
  };

  // Rhythm fingerprint
  rhythm_fingerprint: {
    tempo: number;
    beat_count: number;
    zcr_mean: number;
    zcr_std: number;
    rhythm_density: number;
  };

  // Melodic fingerprint
  melodic_fingerprint: {
    chroma_mean: number[];
    chroma_std: number[];
    tonnetz_mean: number[];
    tonnetz_std: number[];
  };

  // Metadata
  metadata: {
    duration: number;
    sample_rate: number;
    filename: string;
  };
}

// Genre Classification
export interface GenreClassification {
  predicted_genre: string;
  confidence: number;
  all_scores: Record<string, number>;
  top_genres: Array<[string, number]>; // [genre, confidence] pairs
  model_used: boolean;
  model_name?: string;
  primary_genre?: string; // Alternative field name
}

// Subgenre Classification
export interface SubgenreClassification {
  predicted_subgenre: string;
  confidence: number;
  all_scores: Record<string, number>;
  top_subgenres: Array<[string, number]>; // [subgenre, confidence] pairs
  model_used: boolean;
  model_name?: string;
}

// Audio Analysis Response (comprehensive analysis)
export interface AudioAnalysisResponse extends BaseAiResponse {
  features: AudioFeatures;
  fingerprint: AudioFingerprint;
  //genre_classification?: GenreClassification;
  //subgenre_classification?: SubgenreClassification;
  hierarchical_classification: HierarchicalClassification;
}

// Audio Fingerprint Response
export interface AudioFingerprintResponse extends BaseAiResponse {
  fingerprint: AudioFingerprint;
}

// Error Response
export interface AiErrorResponse {
  error: string;
  message: string;
  status: 'error';
}

/**
 *  hierarchical_classification: {
    success: true,
    file_path: '/var/folders/zv/2rc8q3ks52l1ggf5f0mnj02h0000gn/T/tmpdj_nyx0j.flac',
    classification: { genre: 'Electronic', subgenre: 'Ambient', confidence: [Object] },
    processing_time: 0.29,
    timestamp: 1758961798.3581991,
    details: {
      genre_probabilities: [Object],
      subgenre_probabilities: [Object],
      specialist_used: 'Electronic',
      processing_steps: [Array]
    }
  }
 */

export interface HierarchicalClassificationGenreDetails {
  file_path: string;
  predicted_genre: string;
  confidence: number;
  all_probabilities: Record<string, number>;
  model_name: string;
}

export interface HierarchicalClassificationDetails {
  genre_details: HierarchicalClassificationGenreDetails;
  subgenre_details: HierarchicalClassificationGenreDetails;
  specialist_used: string;
  processing_steps: string[];
}

export interface HierarchicalClassification {
  success: boolean;
  file_path: string;
  classification: {
    genre: string;
    subgenre: string;
    confidence: {
      genre: number;
      subgenre: number;
      combined: number;
    };
  };
  processing_time: number;
  timestamp: number;
  details: HierarchicalClassificationDetails;
}
