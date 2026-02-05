import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/clean-arch/infrastructure/database/prisma.service';
import { HiddenMusicTrack } from 'src/clean-arch/kernel/types/model-types';
import { toDomain, toPrisma } from './hidden-music-track.mapper';

@Injectable()
export class HiddenMusicTrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(hiddenMusicTrack: HiddenMusicTrack): Promise<HiddenMusicTrack> {
    return this.prisma.hiddenMusicTrack
      .create({
        data: toPrisma(hiddenMusicTrack),
      })
      .then(toDomain);
  }
}
