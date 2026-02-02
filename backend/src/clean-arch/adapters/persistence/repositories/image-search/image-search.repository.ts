import { Injectable } from '@nestjs/common';
import {
  CreateImageSearchData,
  IImageSearchRepository,
} from 'src/clean-arch/application/ports/repositories/IImageSearchRepository';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import { ImageSearch } from 'src/clean-arch/kernel/types/model-types';
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
