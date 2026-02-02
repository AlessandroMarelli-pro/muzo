import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { ImageSearch } from 'src/clean-arch/kernel/types/model-types';

export type CreateImageSearchData = {
  searchUrl: string;
  imagePath?: string;
  imageUrl?: string;
  source?: string;
};

export const IMAGE_SEARCH_REPOSITORY = Symbol('IImageSearchRepository');

export interface IImageSearchRepository {
  save(
    trackId: MusicTrackId,
    data: CreateImageSearchData,
  ): Promise<ImageSearch>;
}
