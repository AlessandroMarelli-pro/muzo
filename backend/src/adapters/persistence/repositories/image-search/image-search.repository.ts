import { Inject, Injectable } from '@nestjs/common';
import {
  CreateImageSearchData,
  IImageSearchRepository,
  TrackImage,
} from 'src/application/ports/repositories/IImageSearchRepository';
import { MusicTrackId } from 'src/kernel/ids';
import { extractModelId } from 'src/kernel/ids/factory';
import { getCurrentUserId } from 'src/kernel/types/context';
import { ImageSearch } from 'src/kernel/types/model-types';
import { PRISMA_SERVICE, PrismaService } from '../../../../infrastructure/database/prisma.service';
import { toDomain, toPrismaCreate } from './image-search.mapper';

const DEFAULT_IMAGE_MIME_TYPE = 'image/jpeg';

@Injectable()
export class ImageSearchRepository implements IImageSearchRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async save(trackId: MusicTrackId, data: CreateImageSearchData): Promise<ImageSearch> {
    const trackIdDb = extractModelId(trackId).dbId;
    return this.prisma.imageSearch
      .create({
        data: toPrismaCreate(trackIdDb, data, getCurrentUserId()),
      })
      .then(toDomain);
  }

  async findLatestImageForTrack(trackId: MusicTrackId): Promise<TrackImage | null> {
    const trackIdDb = extractModelId(trackId).dbId;
    const row = await this.prisma.imageSearch.findFirst({
      where: { trackId: trackIdDb, imageData: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { imageData: true, imageMimeType: true },
    });

    if (!row?.imageData) {
      return null;
    }

    return {
      data: Buffer.from(row.imageData),
      mimeType: row.imageMimeType ?? DEFAULT_IMAGE_MIME_TYPE,
    };
  }
}
