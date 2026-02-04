import type {
  MusicTrack,
  PlaylistTrack,
} from 'src/clean-arch/kernel/types/model-types';

export type PlaylistTrackWithTrackDetail = Readonly<PlaylistTrack> & {
  track: MusicTrack;
};
