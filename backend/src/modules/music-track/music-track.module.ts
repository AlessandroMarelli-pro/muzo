import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { FilterModule } from '../filter/filter.module';
import { PlaylistModule } from '../playlist/playlist.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { MusicTrackResolver } from './music-track.resolver';
import { MusicTrackService } from './music-track.service';

@Module({
  imports: [SharedModule, PlaylistModule, FilterModule, RecommendationModule],
  controllers: [],
  providers: [MusicTrackResolver, MusicTrackService],
  exports: [MusicTrackService],
})
export class MusicTrackModule {}
