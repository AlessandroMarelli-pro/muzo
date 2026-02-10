import { Injectable } from '@nestjs/common';
import {
  CreateImageSearchData,
  IImageSearchRepository,
} from 'src/application/ports/repositories/IImageSearchRepository';
import { MusicTrackId } from 'src/kernel/ids';
import { extractModelId } from 'src/kernel/ids/factory';
import { getCurrentUserId } from 'src/kernel/types/context';
import { ImageSearch } from 'src/kernel/types/model-types';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { toDomain, toPrismaCreate } from './image-search.mapper';

@Injectable()
export class ImageSearchRepository implements IImageSearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    trackId: MusicTrackId,
    data: CreateImageSearchData,
  ): Promise<ImageSearch> {
    const trackIdDb = extractModelId(trackId).dbId;
    return this.prisma.imageSearch
      .create({
        data: toPrismaCreate(trackIdDb, data, getCurrentUserId()),
      })
      .then((row) => toDomain(row));
  }
}
