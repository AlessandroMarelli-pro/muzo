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

export interface ICosineProvider {
  searchTrack(artist: string, title: string): Promise<CosineTrack | null>;
  lookupTrackByUrl(url: string): Promise<CosineTrack | null>;
  getSimilarTracks(trackId: string, limit?: number): Promise<CosineSimilarTrack[]>;
}
