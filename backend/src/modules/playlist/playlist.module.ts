import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { FilterModule } from '../filter/filter.module';
import { RecommendationModule } from '../recommendation/recommendation.module';

import { PlaylistResolver } from './playlist.resolver';

@Module({
  imports: [FilterModule, RecommendationModule],
  providers: [PlaylistResolver, PrismaService],
})
export class PlaylistModule {}
