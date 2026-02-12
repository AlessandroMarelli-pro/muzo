import { MusicTrackId } from 'src/kernel/ids';
import { MusicTrack } from 'src/kernel/types';
import { createToken } from '../../utils/create-token';
export const TRACK_INDEXER_PORT =
  createToken<ITrackIndexerPort>('TRACK_INDEXER_PORT');

export interface ITrackIndexerPort {
  createIndex(): Promise<void>;
  indexTrack(document: MusicTrack): Promise<void>;
  indexTracks(documents: MusicTrack[]): Promise<void>;
  deleteTrack(trackId: MusicTrackId): Promise<void>;
  deleteTracks(trackIds: MusicTrackId[]): Promise<void>;
  recreateIndex(): Promise<void>;
  updateIndexMapping(): Promise<void>;
}
