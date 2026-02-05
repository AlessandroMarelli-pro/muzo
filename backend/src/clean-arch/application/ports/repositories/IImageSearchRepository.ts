import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { ImageSearch } from 'src/clean-arch/kernel/types/model-types';
import { createToken } from '../../utils/create-token';

export type CreateImageSearchData = {
  searchUrl: string;
  imagePath?: string;
  imageUrl?: string;
  source?: string;
};

export const IMAGE_SEARCH_REPOSITORY = createToken<IImageSearchRepository>(
  'IMAGE_SEARCH_REPOSITORY',
);

export interface IImageSearchRepository {
  save(
    trackId: MusicTrackId,
    data: CreateImageSearchData,
  ): Promise<ImageSearch>;
}
