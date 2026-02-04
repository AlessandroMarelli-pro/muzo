import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { AudioFeatures } from '../dtos/AudioFeatures';
import { TrackIndexDocument } from '../dtos/TrackIndexDocument';
import { TrackIndexDocumentSimilarity } from '../dtos/TrackIndexDocumentSimilarity';

export const TRACK_INDEXER_PORT = Symbol('ITrackIndexerPort');

export interface ITrackIndexerPort {
  createIndex(): Promise<void>;
  indexTrack(document: TrackIndexDocument): Promise<void>;
  indexTracks(documents: TrackIndexDocument[]): Promise<void>;
  deleteTrack(trackId: MusicTrackId): Promise<void>;
  deleteTracks(trackIds: MusicTrackId[]): Promise<void>;
  recreateIndex(): Promise<void>;
  updateIndexMapping(): Promise<void>;
  searchTracks(
    playlistFeatures: AudioFeatures,
    query: any,
  ): Promise<TrackIndexDocumentSimilarity[]>;
}
