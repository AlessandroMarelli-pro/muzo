import { IPlaylistRepository } from 'src/clean-arch/application/ports/repositories/IPlaylistRepository';
import { PlaylistId, UserId } from 'src/clean-arch/kernel/ids';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { createNotFoundError } from 'src/clean-arch/kernel/types';
import { Playlist } from 'src/clean-arch/kernel/types/model-types';
import { PrismaService } from 'src/shared/services/prisma.service';
import { handlePrismaNotFound } from '../prisma-errors';
import { toDomain } from './toDomain';
import { toPrisma } from './toPrisma';

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
      .findUnique({
        where: { id: extractModelId(id).dbId },
      })
      .then((row) => {
        if (!row) throw createNotFoundError(`Playlist with ID ${id} not found`);
        return toDomain(row);
      });
  }

  async getManyByUserId(userId: UserId): Promise<Playlist[]> {
    return this.prisma.playlist
      .findMany({
        where: { createdById: extractModelId(userId).dbId },
      })
      .then((rows) => rows.map(toDomain));
  }

  async updateOneById(id: PlaylistId, playlist: Playlist): Promise<Playlist> {
    return this.prisma.playlist
      .update({
        where: { id: extractModelId(id).dbId },
        data: toPrisma(playlist),
      })
      .then(toDomain);
  }

  async deleteOneById(id: PlaylistId): Promise<boolean> {
    return this.prisma.playlist
      .delete({
        where: { id: extractModelId(id).dbId },
      })
      .then(() => true)
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Playlist with ID ${id} not found`),
      );
  }
}
