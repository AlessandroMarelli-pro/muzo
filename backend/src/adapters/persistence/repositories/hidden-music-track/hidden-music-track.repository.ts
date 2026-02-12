import { Injectable, Inject } from '@nestjs/common';
import {
  PRISMA_SERVICE,
  PrismaService,
} from 'src/infrastructure/database/prisma.service';
import { getCurrentUser } from 'src/kernel/types/context';
import { HiddenMusicTrack } from 'src/kernel/types/model-types';
import { toDomain, toPrisma } from './hidden-music-track.mapper';

@Injectable()
export class HiddenMusicTrackRepository {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
  ) {}

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
}
