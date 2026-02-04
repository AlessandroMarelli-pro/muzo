import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { FilterModule } from '../filter/filter.module';
import { MusicTrackResolver } from './music-track.resolver';
import { MusicTrackService } from './music-track.service';

@Module({
  imports: [SharedModule, FilterModule],
  controllers: [],
  providers: [MusicTrackResolver, MusicTrackService],
  exports: [MusicTrackService],
})
export class MusicTrackModule {}
