import { MusicTrackId } from 'src/kernel/ids';
import { ImageSearch } from 'src/kernel/types/model-types';
import { createToken } from '../../utils/create-token';

export type CreateImageSearchData = {
  searchUrl: string;
  imagePath?: string;
  imageUrl?: string;
  source?: string;
  imageData?: Uint8Array<ArrayBuffer>;
  imageMimeType?: string;
};

export type TrackImage = {
  data: Buffer;
  mimeType: string;
};

export const IMAGE_SEARCH_REPOSITORY =
  createToken<IImageSearchRepository>('IMAGE_SEARCH_REPOSITORY');

export interface IImageSearchRepository {
  save(trackId: MusicTrackId, data: CreateImageSearchData): Promise<ImageSearch>;
  /** Most recent stored cover-art bytes for a track, or null if none. */
  findLatestImageForTrack(trackId: MusicTrackId): Promise<TrackImage | null>;
}
