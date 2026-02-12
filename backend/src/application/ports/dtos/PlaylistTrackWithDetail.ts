import type { MusicTrack, PlaylistTrack } from 'src/kernel/types/model-types';

export type PlaylistTrackWithTrackDetail = Readonly<PlaylistTrack> & {
  track: MusicTrack;
};
