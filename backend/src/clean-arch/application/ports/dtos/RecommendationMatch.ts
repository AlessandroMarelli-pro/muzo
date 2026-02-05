import { MusicTrack } from 'src/clean-arch/kernel/types';

export type RecommendationMatch = {
  track: Partial<MusicTrack>;
  similarity: number;
  reasons: string[];
};
