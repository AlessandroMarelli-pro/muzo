import { AIAnalysisResult } from '@prisma/client';

export { AIAnalysisResult };

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

export interface AIAnalysisResultWithRelations extends AIAnalysisResult {
  track: {
    id: string;
    fileName: string;
    duration: number;
    format: string;
  };
  fingerprint: {
    id: string;
    tempo?: number;
    key?: string;
    energy?: number;
    valence?: number;
    danceability?: number;
  };
}

export interface GenreClassification {
  primaryGenre: string;
  confidence: number;
  alternativeGenres?: Array<{
    genre: string;
    confidence: number;
  }>;
}

export interface ArtistSuggestion {
  suggestedArtist: string;
  confidence: number;
  source: string;
}

export interface AlbumSuggestion {
  suggestedAlbum: string;
  confidence: number;
  source: string;
}

export interface AIAnalysisQueryOptions {
  trackId?: string;
  fingerprintId?: string;
  modelVersion?: string;
  minConfidence?: number;
  hasArtistSuggestion?: boolean;
  hasAlbumSuggestion?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'processingTime' | 'confidence';
  orderDirection?: 'asc' | 'desc';
}
