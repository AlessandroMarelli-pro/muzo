import { Injectable } from '@nestjs/common';
import { PlaylistTrackWithTrackDetailAndSorting } from 'src/clean-arch/application/dtos/PlaylistWithTrackDetailsAndSorting';
import {
  IPlaylistRepository,
  PlaylistUpdateData,
  PlaylistWithSorting,
} from 'src/clean-arch/application/ports/repositories/IPlaylistRepository';
import { PlaylistSortingOptions } from 'src/clean-arch/application/ports/repositories/IPlaylistTrackRepository';
import { Maybe } from 'src/clean-arch/kernel/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import { Playlist } from 'src/clean-arch/kernel/types/model-types';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { playlistWithTracksInclude } from '../../includes/playlist-includes';
import { handlePrismaNotFound } from '../prisma-errors';
import {
  toDomain,
  toDomainWithSorting,
  toDomainWithTracksWithRelationsAndSorting,
  toPrisma,
  toPrismaUpdateData,
} from './playlist.mapper';

@Injectable()
export class PlaylistRepository implements IPlaylistRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(playlist: Playlist): Promise<Playlist> {
    return this.prisma.playlist
      .create({
        data: toPrisma(playlist),
      })
      .then(toDomain);
  }
  async getOneById(id: PlaylistId): Promise<PlaylistWithSorting> {
    return this.prisma.playlist
      .findFirstOrThrow({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
        include: { sorting: true },
      })
      .then((row) => toDomainWithSorting(row))
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Playlist with ID ${id} not found`),
      );
  }

  async getOneByIdWithTracks(
    id: PlaylistId,
    sorting: Maybe<PlaylistSortingOptions>,
  ): Promise<PlaylistTrackWithTrackDetailAndSorting> {
    const sortingOpts = sorting
      ? {
          sortingKey: sorting.sortingKey,
          sortingDirection: sorting.sortingDirection,
        }
      : { sortingKey: 'position' as const, sortingDirection: 'asc' as const };

    return this.prisma.playlist
      .findFirstOrThrow({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
        include: playlistWithTracksInclude(sortingOpts),
      })
      .then((row) => toDomainWithTracksWithRelationsAndSorting(row))
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Playlist with ID ${id} not found`),
      );
  }
  async getFavorite(): Promise<PlaylistTrackWithTrackDetailAndSorting> {
    const sortingOpts = {
      sortingKey: 'position' as const,
      sortingDirection: 'asc' as const,
    };
    return this.prisma.playlist
      .findFirstOrThrow({
        where: { createdById: getCurrentUserId(), isFavorite: true },
        include: playlistWithTracksInclude(sortingOpts),
      })
      .then((row) => toDomainWithTracksWithRelationsAndSorting(row))
      .catch((e: unknown) =>
        handlePrismaNotFound(e, 'Favorite playlist not found'),
      );
  }

  async getMany(): Promise<Playlist[]> {
    return this.prisma.playlist
      .findMany({
        where: { createdById: getCurrentUserId() },
      })
      .then((rows) => rows.map(toDomain));
  }
  async updateOneById(
    id: PlaylistId,
    data: PlaylistUpdateData,
  ): Promise<Playlist> {
    return this.prisma.playlist
      .update({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
        data: toPrismaUpdateData(data),
      })
      .then(toDomain)
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Playlist with ID ${id} not found`),
      );
  }

  async deleteOneById(id: PlaylistId): Promise<boolean> {
    return this.prisma.playlist
      .delete({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .then(() => true)
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Playlist with ID ${id} not found`),
      );
  }

  async verifyAccess(id: PlaylistId): Promise<boolean> {
    return this.prisma.playlist
      .findFirstOrThrow({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .then(() => true)
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Playlist with ID ${id} not found`),
      );
  }
}
