import { MusicTrack } from 'src/kernel/types';

export type RecommendationMatch = {
  track: Omit<
    MusicTrack,
    | 'createdAt'
    | 'updatedAt'
    | 'createdById'
    | 'updatedById'
    | 'libraryId'
    | 'stats'
    | 'fileInfo'
    | 'technicalInfo'
    | 'analysisInfo'
  >;
  similarity: number;
  reasons: string[];
};
