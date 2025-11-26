import { RepeatMode, UserPreferences } from '@prisma/client';

export { RepeatMode, UserPreferences };

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

export interface UserPreferencesQueryOptions {
  userId?: string;
  theme?: string;
  language?: string;
  timezone?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

export interface UserPreferencesStats {
  totalUsers: number;
  themeDistribution: Record<string, number>;
  languageDistribution: Record<string, number>;
  timezoneDistribution: Record<string, number>;
  averageVolume: number;
  autoPlayEnabled: number;
  shuffleModeEnabled: number;
  repeatModeDistribution: Record<RepeatMode, number>;
  autoAnalyzeEnabled: number;
  averageConfidenceThreshold: number;
  autoScanEnabled: number;
  averageScanInterval: number;
  includeSubdirectoriesEnabled: number;
  shareListeningDataEnabled: number;
  shareAnalysisDataEnabled: number;
}
