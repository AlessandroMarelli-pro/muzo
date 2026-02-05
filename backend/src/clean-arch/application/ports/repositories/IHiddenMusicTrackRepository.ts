import { HiddenMusicTrack } from 'src/clean-arch/kernel/types/model-types';

export const HIDDEN_MUSIC_TRACK_REPOSITORY = Symbol(
  'IHiddenMusicTrackRepository',
);

export interface IHiddenMusicTrackRepository {
  save(hiddenMusicTrack: HiddenMusicTrack): Promise<HiddenMusicTrack>;
}
