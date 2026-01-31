import { Injectable } from '@nestjs/common';
import {
  IPlaylistRepository,
  PlaylistUpdateData,
  PlaylistWithSorting,
  PlaylistWithSortingAndTracks,
} from 'src/clean-arch/application/ports/repositories/IPlaylistRepository';
import { PlaylistSortingOptions } from 'src/clean-arch/application/ports/repositories/IPlaylistTrackRepository';
import { Maybe } from 'src/clean-arch/kernel/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import { Playlist } from 'src/clean-arch/kernel/types/model-types';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { toDomain as toDomainMusicTrack } from '../music-track/music-track.mapper';
import { toDomain as toDomainSorting } from '../playlist-sorting/playlist-sorting.mapper';
import { toDomain as toDomainPlaylistTrack } from '../playlist-track/playlist-track.mapper';
import { handlePrismaNotFound } from '../prisma-errors';
import { toDomain, toPrisma, toPrismaUpdateData } from './playlist.mapper';

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
      .then((row) => ({
        ...toDomain(row),
        sorting: row.sorting ? toDomainSorting(row.sorting) : null,
      }))
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Playlist with ID ${id} not found`),
      );
  }

  async getOneByIdWithTracks(
    id: PlaylistId,
    sorting: Maybe<PlaylistSortingOptions>,
  ): Promise<PlaylistWithSortingAndTracks> {
    const sortingOpts = sorting
      ? {
          sortingKey: sorting.sortingKey,
          sortingDirection: sorting.sortingDirection,
        }
      : { sortingKey: 'position' as const, sortingDirection: 'asc' as const };

    return this.prisma.playlist
      .findFirstOrThrow({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
        include: {
          sorting: true,
          tracks: {
            include: {
              track: true,
            },
            orderBy: {
              [sortingOpts.sortingKey]: sortingOpts.sortingDirection,
            },
          },
        },
      })
      .then((row) => {
        return {
          ...toDomain(row),
          sorting: row.sorting ? toDomainSorting(row.sorting) : null,
          tracks: row.tracks.map((track) => ({
            ...toDomainPlaylistTrack(track),
            track: toDomainMusicTrack(track.track),
          })),
        };
      })
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Playlist with ID ${id} not found`),
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
}
