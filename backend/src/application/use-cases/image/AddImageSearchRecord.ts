import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { MusicTrackId } from 'src/kernel/ids';
import { ImageSearch } from 'src/kernel/types/model-types';
import {
  CreateImageSearchData,
  IImageSearchRepository,
} from '../../ports/repositories/IImageSearchRepository';

export type AddImageSearchRecordData = {
  imagePath: string;
  imageUrl?: string;
  source?: string;
};

const IMAGES_DIR_KEY = 'images.dir';
const DEFAULT_IMAGES_RELATIVE = '../muzo/images';

export class AddImageSearchRecordUseCase {
  constructor(
    private readonly imageSearchRepository: IImageSearchRepository,
    private readonly configService: ConfigService,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('AddImageSearchRecordUseCase');
  }

  async execute(trackId: MusicTrackId, data: AddImageSearchRecordData): Promise<ImageSearch> {
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
    this.logger.debug('Adding image search record', {
      trackId,
      createData,
    });
    return this.imageSearchRepository.save(trackId, createData);
  }
}
