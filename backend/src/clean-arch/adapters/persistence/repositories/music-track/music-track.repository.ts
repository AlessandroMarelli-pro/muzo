import { Injectable } from '@nestjs/common';
import { IMusicTrackRepository } from 'src/clean-arch/application/ports/repositories/IMusicTrackRepository';
import { extractModelId, MusicTrackId } from 'src/clean-arch/kernel/ids';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { handlePrismaNotFound } from '../prisma-errors';
import { toDomain } from './music-track.mapper';

@Injectable()
export class MusicTrackRepository implements IMusicTrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOneById(id: MusicTrackId): Promise<MusicTrack> {
    return this.prisma.musicTrack
      .findUniqueOrThrow({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Music track with ID ${id} not found`),
      )
      .then(toDomain);
  }

  verifyExistence(id: MusicTrackId): Promise<boolean> {
    return this.prisma.musicTrack
      .findUniqueOrThrow({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .then(() => true)
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Music track with ID ${id} not found`),
      );
  }
}
