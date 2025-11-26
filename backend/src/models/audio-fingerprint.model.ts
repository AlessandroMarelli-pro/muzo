import { AudioFingerprint } from '@prisma/client';

export { AudioFingerprint };

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

export interface AudioFingerprintWithRelations extends AudioFingerprint {
  track: {
    id: string;
    fileName: string;
    duration: number;
    format: string;
  };
  aiAnalysisResult?: {
    id: string;
    modelVersion: string;
    processingTime: number;
  };
}

export interface AudioFeatureAnalysis {
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

export interface AudioFingerprintQueryOptions {
  trackId?: string;
  hasTempo?: boolean;
  hasKey?: boolean;
  energyRange?: {
    min: number;
    max: number;
  };
  valenceRange?: {
    min: number;
    max: number;
  };
  danceabilityRange?: {
    min: number;
    max: number;
  };
  limit?: number;
  offset?: number;
}
