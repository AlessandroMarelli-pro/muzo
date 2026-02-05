import { MusicTrack } from 'src/clean-arch/kernel/types';
import { createToken } from '../../utils/create-token';

export const MUSIC_TRACK_QUERIES = createToken<IMusicTrackQueries>(
  'MUSIC_TRACK_QUERIES',
);

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
