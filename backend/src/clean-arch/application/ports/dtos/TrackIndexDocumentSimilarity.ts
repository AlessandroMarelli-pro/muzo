import { TrackIndexDocument } from './TrackIndexDocument';

export type TrackIndexDocumentSimilarity = {
  track: TrackIndexDocument;
  similarity: number;
  reasons: string[];
};
