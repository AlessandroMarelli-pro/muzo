export interface RecommendationWeights {
  audioSimilarity: number; // MFCC, chroma, spectral features
  genreSimilarity: number; // AI genre + subgenre classification
  metadataSimilarity: number; // Artist, album, year patterns
  userBehavior: number; // Listening history, favorites
  audioFeatures: number; // Tempo, key, energy, valence
}

export interface RecommendationCriteria {
  weights: RecommendationWeights;
  limit?: number;
  excludeTrackIds?: string[];
}

export interface TrackSimilarity {
  track: any; // MusicTrack type
  similarity: number;
  reasons: string[];
}

export interface PlaylistRecommendationDto {
  playlistId: string;
  limit?: number;
  excludeTrackIds?: string[];
}

export interface TrackRecommendationDto {
  trackId: string;
  limit?: number;
  excludeTrackIds?: string[];
}

export interface AudioFeatures {
  tempo?: number;
  key?: string;
  camelotKey?: string;
  energy?: number;
  valence?: number;
  valenceMood?: string;
  arousal?: number;
  arousalMood?: string;
  danceability?: number;
  danceabilityFeeling?: string;
  genres?: string[];
  subgenres?: string[];
  artist?: string;
  album?: string;
  mfcc?: number[];
  chromaMean?: number[]; // 12-dimensional pitch class distribution
  chromaOverallMean?: number;
  chromaDominantPitch?: number;
  tonnetzMean?: number[]; // 6-dimensional tonal centroid
  tonnetzOverallMean?: number;
  spectralCentroid?: number;
  spectralRolloff?: number;
  zeroCrossingRate?: number;
  acousticness?: number;
  instrumentalness?: number;
  speechiness?: number;
  liveness?: number;
  rhythmStability?: number;
  bassPresence?: number;
  tempoRegularity?: number;
  syncopation?: number;
  beatStrength?: number;
  brightnessFactor?: number;
  harmonicFactor?: number;
  spectralBalance?: number;
  modeFactor?: number;
  energyKeywords?: string[];
  energyComment?: string;
}

export interface PlaylistFeatures {
  tempo?: number;
  key?: string;
  energy?: number;
  valence?: number;
  danceability?: number;
  genres?: string[];
  subgenres?: string[];
  artist?: string;
  album?: string;
  mfcc?: number[];
  chroma?: number[];
  spectralCentroid?: number;
  spectralRolloff?: number;
  artistCounts: Record<string, number>;
  albumCounts: Record<string, number>;
}

export interface UserRecommendationPreferences {
  id: string;
  userId: string;
  weights: RecommendationWeights;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRecommendationPreferencesDto {
  userId: string;
  weights: RecommendationWeights;
  isDefault?: boolean;
}

export interface UpdateUserRecommendationPreferencesDto {
  weights?: RecommendationWeights;
  isDefault?: boolean;
}
