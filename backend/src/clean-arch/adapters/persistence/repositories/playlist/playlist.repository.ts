import { Injectable } from '@nestjs/common';
import {
  IPlaylistRepository,
  PlaylistUpdateData,
} from 'src/clean-arch/application/ports/repositories/IPlaylistRepository';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import { Playlist } from 'src/clean-arch/kernel/types/model-types';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
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
  async getOneById(id: PlaylistId): Promise<Playlist> {
    return this.prisma.playlist
      .findUniqueOrThrow({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .then(toDomain)
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
