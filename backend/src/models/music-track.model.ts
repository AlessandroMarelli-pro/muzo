import { AnalysisStatus, MusicTrack } from '@prisma/client';

export { AnalysisStatus, MusicTrack };

export interface CreateMusicTrackDto {
  filePath: string;
  fileName: string;
  fileSize: number;
  duration: number;
  format: string;
  bitrate?: number;
  sampleRate?: number;
  originalTitle?: string;
  originalArtist?: string;
  originalAlbum?: string;
  originalYear?: number;
  libraryId: string;
}

export interface UpdateMusicTrackDto {
  originalTitle?: string;
  originalArtist?: string;
  originalAlbum?: string;
  originalYear?: number;
  aiTitle?: string;
  aiArtist?: string;
  aiAlbum?: string;
  aiConfidence?: number;
  aiDescription?: string;
  aiTags?: string[];
  aiSubgenreConfidence?: number;
  userTitle?: string;
  userArtist?: string;
  userAlbum?: string;
  userTags?: string[];
  analysisStatus?: AnalysisStatus;
  analysisError?: string;
  isFavorite?: boolean;
  genreIds?: string[];
  subgenreIds?: string[];
}

export interface MusicTrackWithRelations extends MusicTrack {
  library: {
    id: string;
    name: string;
  };
  audioFingerprint?: {
    id: string;
    tempo?: number;
    key?: string;
    energy?: number;
    valence?: number;
    danceability?: number;
    acousticness?: number;
    instrumentalness?: number;
    speechiness?: number;
    contrast?: number[];
    chroma?: number[];
    zeroCrossingRate?: number;
    spectralCentroid?: number;
    spectralRolloff?: number;
    spectralContrast?: number[];
  };
  aiAnalysisResult?: {
    id: string;
    modelVersion: string;
    processingTime: number;
  };
  editorSessions?: Array<{
    id: string;
    sessionStatus: string;
    createdAt: Date;
  }>;
  playbackSessions?: Array<{
    id: string;
    sessionType: string;
    startTime: Date;
    duration?: number;
  }>;
  imageSearches?: Array<{
    id: string;
    imagePath: string;
    imageUrl: string;
    source: string;
  }>;
  trackGenres?: Array<{
    id: string;
    genreId: string;
    genre: {
      id: string;
      name: string;
    };
  }>;
  trackSubgenres?: Array<{
    id: string;
    subgenreId: string;
    subgenre: {
      id: string;
      name: string;
    };
  }>;
}

export interface MusicTrackQueryOptions {
  libraryId?: string;
  analysisStatus?: AnalysisStatus;
  format?: string;
  limit?: number;
  offset?: number;
  orderBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'fileName'
    | 'duration'
    | 'listeningCount'
    | 'tempo'
    | 'key'
    | 'energy'
    | 'valence'
    | 'danceability'
    | 'acousticness'
    | 'instrumentalness'
    | 'speechiness';
  orderDirection?: 'asc' | 'desc';
  isFavorite?: boolean;
}

export interface MusicTrackStats {
  totalTracks: number;
  totalDuration: number;
  averageDuration: number;
  totalFileSize: number;
  averageFileSize: number;
  formatDistribution: Record<string, number>;
  analysisStatusDistribution: Record<AnalysisStatus, number>;
}

export interface MusicTrackByCategories<T = MusicTrack> {
  category: 'genre' | 'subgenre';
  name: string;
  tracks: T[];
  trackCount: number;
}

export interface ElasticsearchMusicTrackDocument {
  // MusicTrack core fields
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  duration: number;
  format: string;
  bitrate?: number;
  sample_rate?: number;

  // Original Metadata
  original_title?: string;
  original_artist?: string;
  original_album?: string;
  original_year?: number;
  original_albumartist?: string;
  original_date?: string | Date;
  original_bpm?: number;
  original_track_number?: number;
  original_disc_number?: string;
  original_comment?: string;
  original_composer?: string;
  original_copyright?: string;

  // AI-Generated Metadata
  ai_title?: string;
  ai_artist?: string;
  ai_album?: string;
  ai_confidence?: number;
  ai_subgenre_confidence?: number;
  ai_description?: string;
  ai_tags?: string[];

  // User Modifications
  user_title?: string;
  user_artist?: string;
  user_album?: string;
  user_tags?: string[];

  // Listening Data
  listening_count?: number;
  last_played_at?: string | Date;
  is_favorite?: boolean;

  // Analysis Status
  analysis_status?: string;
  analysis_started_at?: string | Date;
  analysis_completed_at?: string | Date;
  analysis_error?: string;
  has_musicbrainz?: boolean;
  has_discogs?: boolean;

  // Library information
  library_id: string;
  library_name?: string;

  // Timestamps
  created_at?: string | Date;
  updated_at?: string | Date;

  // Audio Fingerprint: elasticsearch nested doc structure
  audio_fingerprint?: {
    mfcc?: number[];
    spectral_centroid?: Record<string, any>;
    spectral_rolloff?: Record<string, any>;
    spectral_spread?: Record<string, any>;
    spectral_bandwidth?: Record<string, any>;
    spectral_flatness?: Record<string, any>;
    spectral_contrast?: any[];
    chroma?: Record<string, any>;
    tonnetz?: Record<string, any>;
    zero_crossing_rate?: Record<string, any>;
    rms?: Record<string, any>;
    tempo?: number;
    key?: string;
    camelot_key?: string;
    valence?: number;
    valence_mood?: string;
    arousal?: number;
    arousal_mood?: string;
    danceability?: number;
    danceability_feeling?: string;
    rhythm_stability?: number;
    bass_presence?: number;
    tempo_regularity?: number;
    tempo_appropriateness?: number;
    energy_factor?: number;
    syncopation?: number;
    acousticness?: number;
    instrumentalness?: number;
    speechiness?: number;
    liveness?: number;
    mode_factor?: number;
    mode_confidence?: number;
    mode_weight?: number;
    tempo_factor?: number;
    brightness_factor?: number;
    harmonic_factor?: number;
    spectral_balance?: number;
    beat_strength?: number;
    audio_hash?: string;
    file_hash?: string;
    energy_comment?: string;
    energy_keywords?: any[];
    energy_by_band?: any[];
  } | null;

  ai_analysis?: {
    model_version?: string;
    genre_classification?: Record<string, any>;
    artist_suggestion?: any;
    album_suggestion?: any;
    processing_time?: number;
    error_message?: string;
  } | null;

  // Genres and Subgenres (normalized)
  genres?: string[];
  subgenres?: string[];

  // Computed display fields
  title?: string;
  artist?: string;
  album?: string;
  image_path?: string;
}
