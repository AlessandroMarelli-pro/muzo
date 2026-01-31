import { Injectable } from '@nestjs/common';
import { IMusicTrackRepository } from 'src/clean-arch/application/ports/repositories/IMusicTrackRepository';
import { extractModelId, MusicTrackId } from 'src/clean-arch/kernel/ids';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';
import { PrismaService } from 'src/shared/services/prisma.service';
import { toDomain } from './music-track.mapper';

@Injectable()
export class MusicTrackRepository implements IMusicTrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOneById(id: MusicTrackId): Promise<MusicTrack> {
    return this.prisma.musicTrack
      .findUnique({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .then(toDomain);
  }
}
