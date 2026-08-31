import { Inject, Injectable } from '@nestjs/common';
import {
  ICosineTrackMatchRepository,
  UpsertCosineTrackMatchData,
} from 'src/application/ports/repositories/ICosineTrackMatchRepository';
import { Maybe } from 'src/kernel/common';
import { MusicTrackId } from 'src/kernel/ids';
import { extractModelId } from 'src/kernel/ids/factory';
import { getCurrentUserId } from 'src/kernel/types/context';
import { CosineTrackMatch } from 'src/kernel/types/model-types';
import { PRISMA_SERVICE, PrismaService } from '../../../../infrastructure/database/prisma.service';
import { toDomain, toPrismaUpsert } from './cosine-track-match.mapper';

@Injectable()
export class CosineTrackMatchRepository implements ICosineTrackMatchRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async findByMusicTrackId(musicTrackId: MusicTrackId): Promise<Maybe<CosineTrackMatch>> {
    const musicTrackIdDb = extractModelId(musicTrackId).dbId;
    const row = await this.prisma.cosineTrackMatch.findUnique({
      where: { musicTrackId: musicTrackIdDb },
    });
    return row ? toDomain(row) : null;
  }

  async upsert(data: UpsertCosineTrackMatchData): Promise<CosineTrackMatch> {
    const musicTrackIdDb = extractModelId(data.musicTrackId).dbId;
    const { create, update } = toPrismaUpsert(data, musicTrackIdDb, getCurrentUserId());
    return this.prisma.cosineTrackMatch
      .upsert({ where: { musicTrackId: musicTrackIdDb }, create, update })
      .then(toDomain);
  }

  async deleteByMusicTrackId(musicTrackId: MusicTrackId): Promise<boolean> {
    const musicTrackIdDb = extractModelId(musicTrackId).dbId;
    const { count } = await this.prisma.cosineTrackMatch.deleteMany({
      where: { musicTrackId: musicTrackIdDb },
    });
    return count > 0;
  }
}
