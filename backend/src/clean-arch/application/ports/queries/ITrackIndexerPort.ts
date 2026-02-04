import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { TrackIndexDocument } from '../dtos/TrackIndexDocument';

export const TRACK_INDEXER_PORT = Symbol('ITrackIndexerPort');

export interface ITrackIndexerPort {
  indexTrack(document: TrackIndexDocument): Promise<void>;
  indexTracks(documents: TrackIndexDocument[]): Promise<void>;
  deleteTrack(trackId: MusicTrackId): Promise<void>;
  deleteTracks(trackIds: MusicTrackId[]): Promise<void>;
  recreateIndex(): Promise<void>;
  updateIndexMapping(): Promise<void>;
}
