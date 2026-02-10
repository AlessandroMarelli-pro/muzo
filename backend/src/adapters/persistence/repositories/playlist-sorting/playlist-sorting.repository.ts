import { Injectable } from '@nestjs/common';
import {
  IPlaylistSortingRepository,
  PlaylistSortingUpsertData,
} from 'src/application/ports/repositories/IPlaylistSortingRepository';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { Maybe } from 'src/kernel/common';
import { extractModelId, PlaylistId } from 'src/kernel/ids';
import { getCurrentUserId } from 'src/kernel/types/context';
import { PlaylistSorting } from 'src/kernel/types/model-types';
import { handlePrismaNotFound } from '../prisma-errors';
import { toDomain, toPrisma } from './playlist-sorting.mapper';

@Injectable()
export class PlaylistSortingRepository implements IPlaylistSortingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(data: PlaylistSorting): Promise<PlaylistSorting> {
    return this.prisma.playlistSorting
      .create({
        data: toPrisma(data),
      })
      .then(toDomain);
  }

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

  update(
    playlistId: PlaylistId,
    data: PlaylistSortingUpsertData,
  ): Promise<PlaylistSorting> {
    return this.prisma.playlistSorting
      .update({
        where: {
          playlistId: extractModelId(playlistId).dbId,
          createdById: getCurrentUserId(),
        },
        data: {
          sortingKey: data.sortingKey,
          sortingDirection: data.sortingDirection,
        },
      })
      .then(toDomain)
      .catch((e: unknown) =>
        handlePrismaNotFound(
          e,
          `Playlist sorting with ID ${playlistId} not found`,
        ),
      );
  }

  verifyExistence(playlistId: PlaylistId): Promise<boolean> {
    return this.prisma.playlistSorting
      .findFirst({
        where: {
          playlistId: extractModelId(playlistId).dbId,
          createdById: getCurrentUserId(),
        },
      })
      .then((row) => row !== null);
  }
}
