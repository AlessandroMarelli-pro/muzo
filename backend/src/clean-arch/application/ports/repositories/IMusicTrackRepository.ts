import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';

export const MUSIC_TRACK_REPOSITORY = Symbol('IMusicTrackRepository');

export interface IMusicTrackRepository {
  getOneById(id: MusicTrackId): Promise<MusicTrack>;
  verifyExistence(id: MusicTrackId): Promise<boolean>;
}
