import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { MusicTrack } from 'src/clean-arch/kernel/types';

export const TRACK_INDEXER_PORT = Symbol('ITrackIndexerPort');

export interface ITrackIndexerPort {
  createIndex(): Promise<void>;
  indexTrack(document: MusicTrack): Promise<void>;
  indexTracks(documents: MusicTrack[]): Promise<void>;
  deleteTrack(trackId: MusicTrackId): Promise<void>;
  deleteTracks(trackIds: MusicTrackId[]): Promise<void>;
  recreateIndex(): Promise<void>;
  updateIndexMapping(): Promise<void>;
}
