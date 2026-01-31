import { Injectable } from '@nestjs/common';
import { IPlaylistTrackRepository } from 'src/clean-arch/application/ports/repositories/IPlaylistTrackRepository';
import { PrismaService } from 'src/clean-arch/infrastructure/database/prisma.service';
import { extractModelId, PlaylistId } from 'src/clean-arch/kernel/ids';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import { PlaylistTrack } from 'src/clean-arch/kernel/types/model-types';
import { toDomain } from './playlist-track.mapper';

@Injectable()
export class PlaylistTrackRepository implements IPlaylistTrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTracksByPlaylistId(
    playlistId: PlaylistId,
  ): Promise<PlaylistTrack[]> {
    return this.prisma.playlistTrack
      .findMany({
        where: {
          playlistId: extractModelId(playlistId).dbId,
          createdById: getCurrentUserId(),
        },
      })
      .then((rows) => rows.map(toDomain));
  }
  async getTracks(): Promise<PlaylistTrack[]> {
    return this.prisma.playlistTrack
      .findMany({
        where: {
          createdById: getCurrentUserId(),
        },
      })
      .then((rows) => rows.map(toDomain));
  }
}
