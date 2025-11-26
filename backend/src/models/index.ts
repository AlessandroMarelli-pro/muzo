import {
  AIAnalysisResult,
  AnalysisStatus,
  AudioFingerprint,
  ImageSearch,
  IntelligentEditorSession,
  MusicLibrary,
  MusicTrack,
  PlaybackSession,
  PlaybackType,
  Playlist,
  PlaylistTrack,
  RepeatMode,
  ScanStatus,
  SessionStatus,
  UserPreferences,
} from '@prisma/client';

// Re-export Prisma types for convenience
export {
  AIAnalysisResult,
  AnalysisStatus,
  AudioFingerprint,
  IntelligentEditorSession,
  MusicLibrary,
  MusicTrack,
  PlaybackSession,
  PlaybackType,
  RepeatMode,
  ScanStatus,
  SessionStatus,
  UserPreferences,
};

// Extended types with relations
export type MusicLibraryWithTracks = MusicLibrary & {
  tracks: MusicTrack[];
};

export type MusicTrackWithRelations = MusicTrack & {
  library: MusicLibrary;
  audioFingerprint?: AudioFingerprint;
  aiAnalysisResult?: AIAnalysisResult;
  editorSessions?: IntelligentEditorSession[];
  playbackSessions?: PlaybackSession[];
  imageSearches?: ImageSearch[];
};

export type AudioFingerprintWithRelations = AudioFingerprint & {
  track: MusicTrack;
  aiAnalysisResult?: AIAnalysisResult;
};

export type AIAnalysisResultWithRelations = AIAnalysisResult & {
  track: MusicTrack;
  fingerprint: AudioFingerprint;
};

export type IntelligentEditorSessionWithRelations = IntelligentEditorSession & {
  track: MusicTrack;
};

export type PlaybackSessionWithRelations = PlaybackSession & {
  track: MusicTrack;
};

// DTOs for creating/updating entities
export interface CreateMusicLibraryDto {
  name: string;
  rootPath: string;
  autoScan?: boolean;
  scanInterval?: number;
  includeSubdirectories?: boolean;
  supportedFormats?: string;
  maxFileSize?: number;
}

export interface UpdateMusicLibraryDto {
  name?: string;
  rootPath?: string;
  autoScan?: boolean;
  scanInterval?: number;
  includeSubdirectories?: boolean;
  supportedFormats?: string;
  maxFileSize?: number;
}

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
  originalGenre?: string;
  originalYear?: number;
  libraryId: string;
}

export interface UpdateMusicTrackDto {
  originalTitle?: string;
  originalArtist?: string;
  originalAlbum?: string;
  originalGenre?: string;
  originalYear?: number;
  aiTitle?: string;
  aiArtist?: string;
  aiAlbum?: string;
  aiGenre?: string;
  aiSubgenre?: string;
  aiConfidence?: number;
  aiSubgenreConfidence?: number;
  userTitle?: string;
  userArtist?: string;
  userAlbum?: string;
  userGenre?: string;
  userTags?: string[];
  analysisStatus?: AnalysisStatus;
  analysisError?: string;
}

export interface CreateAudioFingerprintDto {
  trackId: string;
  mfcc: number[];
  spectralCentroid: number;
  spectralRolloff: number;
  spectralContrast: number[];
  chroma: number[];
  zeroCrossingRate: number;
  tempo?: number;
  key?: string;
  energy?: number;
  valence?: number;
  danceability?: number;
}

export interface CreateAIAnalysisResultDto {
  trackId: string;
  fingerprintId: string;
  modelVersion: string;
  genreClassification: {
    primaryGenre: string;
    confidence: number;
    alternativeGenres?: Array<{
      genre: string;
      confidence: number;
    }>;
  };
  artistSuggestion?: {
    suggestedArtist: string;
    confidence: number;
    source: string;
  };
  albumSuggestion?: {
    suggestedAlbum: string;
    confidence: number;
    source: string;
  };
  processingTime: number;
  errorMessage?: string;
}

export interface CreateIntelligentEditorSessionDto {
  trackId: string;
  userId?: string;
  suggestions: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    confidence?: number;
  };
  confidenceThreshold?: number;
}

export interface CreatePlaybackSessionDto {
  trackId: string;
  userId?: string;
  sessionType?: PlaybackType;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  volume?: number;
  quality?: string;
}

export interface CreateUserPreferencesDto {
  userId?: string;
  theme?: string;
  language?: string;
  timezone?: string;
  defaultVolume?: number;
  autoPlay?: boolean;
  shuffleMode?: boolean;
  repeatMode?: RepeatMode;
  autoAnalyze?: boolean;
  confidenceThreshold?: number;
  preferredGenres?: string[];
  autoScan?: boolean;
  scanInterval?: number;
  includeSubdirectories?: boolean;
  supportedFormats?: string;
  shareListeningData?: boolean;
  shareAnalysisData?: boolean;
}

export interface UpdateUserPreferencesDto {
  theme?: string;
  language?: string;
  timezone?: string;
  defaultVolume?: number;
  autoPlay?: boolean;
  shuffleMode?: boolean;
  repeatMode?: RepeatMode;
  autoAnalyze?: boolean;
  confidenceThreshold?: number;
  preferredGenres?: string[];
  autoScan?: boolean;
  scanInterval?: number;
  includeSubdirectories?: boolean;
  supportedFormats?: string;
  shareListeningData?: boolean;
  shareAnalysisData?: boolean;
}

// Query options
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
    | 'listeningCount';
  orderDirection?: 'asc' | 'desc';
}

export interface MusicLibraryQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name' | 'totalTracks';
  orderDirection?: 'asc' | 'desc';
}

// Statistics types
export interface MusicLibraryStats {
  totalTracks: number;
  analyzedTracks: number;
  pendingTracks: number;
  failedTracks: number;
  totalDuration: number;
  averageDuration: number;
  formatDistribution: Record<string, number>;
  genreDistribution: Record<string, number>;
  yearDistribution: Record<string, number>;
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

export interface PlaylistTrackWithRelations extends PlaylistTrack {
  track: MusicTrackWithRelations;
}

export interface PlaylistWithRelations extends Playlist {
  tracks: PlaylistTrackWithRelations[];
}
