import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { ImageSearch } from 'src/clean-arch/kernel/types/model-types';
import {
  CreateImageSearchData,
  IImageSearchRepository,
  IMAGE_SEARCH_REPOSITORY,
} from '../../ports/repositories/IImageSearchRepository';

export type AddImageSearchRecordData = {
  imagePath: string;
  imageUrl?: string;
  source?: string;
};

const IMAGES_DIR_KEY = 'images.dir';
const DEFAULT_IMAGES_RELATIVE = '../muzo/images';

@Injectable()
export class AddImageSearchRecordUseCase {
  constructor(
    @Inject(IMAGE_SEARCH_REPOSITORY)
    private readonly imageSearchRepository: IImageSearchRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    trackId: MusicTrackId,
    data: AddImageSearchRecordData,
  ): Promise<ImageSearch> {
    const imagesDir =
      this.configService.get<string>(IMAGES_DIR_KEY) ??
      path.join(process.cwd(), DEFAULT_IMAGES_RELATIVE);
    const searchUrl = data.imageUrl ?? path.join(imagesDir, data.imagePath);

    const createData: CreateImageSearchData = {
      searchUrl,
      imagePath: data.imagePath,
      imageUrl: data.imageUrl,
      source: data.source,
    };
    return this.imageSearchRepository.save(trackId, createData);
  }
}
