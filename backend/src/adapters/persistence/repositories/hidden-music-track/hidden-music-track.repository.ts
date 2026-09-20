import { Inject, Injectable } from '@nestjs/common';
import { HiddenTrackImage } from 'src/application/ports/repositories/IHiddenMusicTrackRepository';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { extractModelId, HiddenMusicTrackId } from 'src/kernel/ids';
import { getCurrentUser, getCurrentUserId } from 'src/kernel/types/context';
import { HiddenMusicTrack } from 'src/kernel/types/model-types';
import { PaginationResult, WithPagination } from 'src/kernel/types/pagination';
import { handlePrismaNotFound } from '../prisma-errors';
import { toDomain, toPrisma } from './hidden-music-track.mapper';

@Injectable()
export class HiddenMusicTrackRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async save(hiddenMusicTrack: HiddenMusicTrack): Promise<HiddenMusicTrack> {
    return this.prisma.hiddenMusicTrack
      .create({
        data: toPrisma({
          ...hiddenMusicTrack,
          createdById: getCurrentUser().id,
        }),
      })
      .then(toDomain);
  }

  async getManyWithPagination(
    pagination: WithPagination,
  ): Promise<PaginationResult<HiddenMusicTrack>> {
    const { limit = 50, offset = 0, orderBy, orderDirection } = pagination.pagination;
    const where = { createdById: getCurrentUserId() };
    const count = await this.prisma.hiddenMusicTrack.count({ where });
    return this.prisma.hiddenMusicTrack
      .findMany({
        where,
        take: limit ?? undefined,
        skip: offset ?? undefined,
        orderBy: { [orderBy ?? 'createdAt']: orderDirection ?? 'desc' },
      })
      .then((rows) => {
        if (rows.length === 0) {
          return { items: [], total: 0, page: 0, limit: 0, pages: 0 };
        }
        return {
          items: rows.map(toDomain),
          total: count,
          page: Math.floor(offset / limit) + 1,
          limit: limit ?? 0,
          pages: Math.ceil(count / limit),
        };
      });
  }

  async getOneById(id: HiddenMusicTrackId): Promise<HiddenMusicTrack> {
    return this.prisma.hiddenMusicTrack
      .findUniqueOrThrow({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .catch((e: unknown) => handlePrismaNotFound(e, `Hidden track with ID ${id} not found`))
      .then(toDomain);
  }

  async removeOneById(id: HiddenMusicTrackId): Promise<boolean> {
    return this.prisma.hiddenMusicTrack
      .delete({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .then(() => true);
  }

  async findImageById(id: HiddenMusicTrackId): Promise<HiddenTrackImage | null> {
    const row = await this.prisma.hiddenMusicTrack.findUnique({
      where: { id: extractModelId(id).dbId, imageData: { not: null } },
      select: { imageData: true, imageMimeType: true },
    });
    return row?.imageData
      ? { data: Buffer.from(row.imageData), mimeType: row.imageMimeType ?? 'image/jpeg' }
      : null;
  }
}
