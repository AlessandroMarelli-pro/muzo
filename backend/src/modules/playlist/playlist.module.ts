import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { FilterModule } from '../filter/filter.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { PlaylistController } from './playlist.controller';
import { PlaylistResolver } from './playlist.resolver';
import { PlaylistService } from './playlist.service';

@Module({
  imports: [FilterModule, RecommendationModule],
  providers: [PlaylistService, PlaylistResolver, PrismaService],
  controllers: [PlaylistController],
  exports: [PlaylistService],
})
export class PlaylistModule {}
