import { HiddenMusicTrack } from 'src/clean-arch/kernel/types/model-types';
import { createToken } from '../../utils/create-token';

export const HIDDEN_MUSIC_TRACK_REPOSITORY =
  createToken<IHiddenMusicTrackRepository>('HIDDEN_MUSIC_TRACK_REPOSITORY');

export interface IHiddenMusicTrackRepository {
  save(hiddenMusicTrack: HiddenMusicTrack): Promise<HiddenMusicTrack>;
}
