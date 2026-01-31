import { Injectable } from '@nestjs/common';
import { IPlaylistSortingRepository } from 'src/clean-arch/application/ports/repositories/IPlaylistSortingRepository';
import { PrismaService } from 'src/clean-arch/infrastructure/database/prisma.service';
import { Maybe } from 'src/clean-arch/kernel/common';
import { extractModelId, PlaylistId } from 'src/clean-arch/kernel/ids';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import { PlaylistSorting } from 'src/clean-arch/kernel/types/model-types';
import { toDomain } from './playlist-sorting.mapper';

@Injectable()
export class PlaylistSortingRepository implements IPlaylistSortingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getByPlaylistId(
    playlistId: PlaylistId,
  ): Promise<Maybe<PlaylistSorting>> {
    return this.prisma.playlistSorting
      .findFirst({
        where: {
          playlistId: extractModelId(playlistId).dbId,
          createdById: getCurrentUserId(),
        },
      })
      .then((row) => (row ? toDomain(row) : null));
  }
}
