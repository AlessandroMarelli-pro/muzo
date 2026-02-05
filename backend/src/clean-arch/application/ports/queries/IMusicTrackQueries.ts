import { MusicTrack } from 'src/clean-arch/kernel/types';

export const MUSIC_TRACK_QUERIES = Symbol('IMusicTrackQueries');

export type RandomTrackWithStats = {
  track: MusicTrack;
  likedCount: number;
  bangerCount: number;
  dislikedCount: number;
  remainingCount: number;
};
export interface IMusicTrackQueries {
  getRandomTrackWithStats(): Promise<RandomTrackWithStats>;
}
