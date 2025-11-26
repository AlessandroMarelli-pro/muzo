import { MusicLibrary, ScanStatus } from '@prisma/client';

export { MusicLibrary, ScanStatus };

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

export interface MusicLibraryWithTracks extends MusicLibrary {
  tracks: Array<{
    id: string;
    fileName: string;
    duration: number;
    format: string;
    analysisStatus: string;
  }>;
}

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

export interface MusicLibraryQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name' | 'totalTracks';
  orderDirection?: 'asc' | 'desc';
}
