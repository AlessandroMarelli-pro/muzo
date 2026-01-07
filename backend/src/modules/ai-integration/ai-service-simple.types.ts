/**
 * Simplified AI Service Response Types
 *
 * Streamlined TypeScript interfaces for the Muzo AI Service API responses
 */

// Simplified File Information
export interface SimpleFileInfo {
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
export interface SimpleAudioTechnical {
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
export interface SimpleId3Tags {
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
export interface AggregationStatistics {
  mean: number;
  std: number;
  median: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
}
// Simplified Audio Features
export interface SimpleAudioFeatures {
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
  };
  rhythm_fingerprint: {
    zcr_mean: number;
    zcr_std: number;
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
export interface SimpleAudioFingerprint {
  file_hash: string;
  audio_hash: string;
  method: string;
}

// Simplified Genre Classification Details
export interface SimpleGenreDetails {
  file_path: string;
  predicted_genre: string;
  confidence: number;
  all_probabilities: Record<string, number>;
  model_name: string;
}

// Simplified Classification Details
export interface SimpleClassificationDetails {
  genre_details: SimpleGenreDetails;
  subgenre_details: SimpleGenreDetails;
  specialist_used: string;
  processing_steps: string[];
}

// Simplified Hierarchical Classification
export interface SimpleHierarchicalClassification {
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
  details: SimpleClassificationDetails;
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
export interface SimpleAlbumArt {
  source: string;
  imagePath: string;
  imageUrl: string;
}

// Performance Summary
export interface SimplePerformanceSummary {
  overall_status: string;
  slowest_service: string | null;
  slowest_method: string | null;
  total_bottlenecks: number;
  critical_issues: number;
  threshold_violations: number;
  recommendations_count: number;
  timestamp: string;
}

// Simplified Audio Analysis Response
export interface SimpleAudioAnalysisResponse {
  status: 'success' | 'error';
  message?: string;
  processing_time: number;
  processing_mode: string;
  features: SimpleAudioFeatures;
  fingerprint: SimpleAudioFingerprint;
  hierarchical_classification: SimpleHierarchicalClassification;
  album_art: SimpleAlbumArt;
  file_info: SimpleFileInfo;
  audio_technical: SimpleAudioTechnical;
  id3_tags: SimpleId3Tags;
  ai_metadata: AIMetadataResponse['metadata'];
}

// Error Response
export interface SimpleAiErrorResponse {
  status: 'error';
  message: string;
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
