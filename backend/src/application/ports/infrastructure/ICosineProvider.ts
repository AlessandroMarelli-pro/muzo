import { createToken } from '../../utils/create-token';

export const COSINE_PROVIDER = createToken<ICosineProvider>('COSINE_PROVIDER');

export interface CosineTrack {
  id: string;
  artist: string;
  title: string;
}

export interface CosineSimilarTrack extends CosineTrack {
  score: number;
  videoId?: string;
  externalLink?: string;
}

export interface CosineSimilarFilters {
  startYear?: number;
  endYear?: number;
  minHave?: number;
  maxHave?: number;
  minWant?: number;
  maxWant?: number;
  minPrice?: number;
  maxPrice?: number;
}

export interface CosineBulkSearchMatch {
  query: string;
  track: CosineTrack;
  similarTracks: CosineSimilarTrack[];
}

export interface CosineBulkSearchResult {
  matched: CosineBulkSearchMatch[];
  unmatched: string[];
}

export interface ICosineProvider {
  searchTrack(artist: string, title: string): Promise<CosineTrack | null>;
  lookupTrackByUrl(url: string): Promise<CosineTrack | null>;
  getSimilarTracks(
    trackId: string,
    limit?: number,
    filters?: CosineSimilarFilters,
  ): Promise<CosineSimilarTrack[]>;
  bulkSearch(
    tracks: string[],
    filters?: CosineSimilarFilters & { similarLimit?: number },
  ): Promise<CosineBulkSearchResult>;
}
