import { Inject } from '@nestjs/common';
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
  /** Optimized cover-art bytes as base64, inlined by the ai-service. */
  imageBase64?: string;
  imageMimeType?: string;
};

export class AddImageSearchRecordUseCase {
  constructor(
    private readonly imageSearchRepository: IImageSearchRepository,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('AddImageSearchRecordUseCase');
  }

  async execute(trackId: MusicTrackId, data: AddImageSearchRecordData): Promise<ImageSearch> {
    // .slice() copies into a fresh ArrayBuffer-backed view, which is the exact
    // type Prisma's Bytes field expects (Uint8Array<ArrayBuffer>).
    const imageData = data.imageBase64
      ? Buffer.from(data.imageBase64, 'base64').slice()
      : undefined;

    // The ai-service filesystem is not shared with the backend, so imagePath is
    // only kept as an opaque reference for debugging. searchUrl is the external
    // source URL when there is one.
    const createData: CreateImageSearchData = {
      searchUrl: data.imageUrl ?? data.imagePath ?? '',
      imagePath: data.imagePath,
      imageUrl: data.imageUrl,
      source: data.source,
      imageData,
      imageMimeType: data.imageMimeType,
    };
    this.logger.debug('Adding image search record', {
      trackId,
      source: data.source,
      hasBytes: !!imageData,
      byteLength: imageData?.length,
    });
    return this.imageSearchRepository.save(trackId, createData);
  }
}
