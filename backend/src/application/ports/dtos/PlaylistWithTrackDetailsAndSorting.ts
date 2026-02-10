import { Playlist, PlaylistSorting } from 'src/kernel/types/model-types';
import { PlaylistTrackWithTrackDetail } from './PlaylistTrackWithDetail';

export type PlaylistTrackWithTrackDetailAndSorting = Playlist & {
  sorting: PlaylistSorting;
  tracks: PlaylistTrackWithTrackDetail[];
};
