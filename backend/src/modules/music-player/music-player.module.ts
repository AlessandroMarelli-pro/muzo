import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { MusicTrackModule } from '../music-track/music-track.module';
import { AudioAnalysisService } from './audio-analysis.service';
import { AudioStreamingController } from './audio-streaming.controller';
import { MusicPlayerResolver } from './music-player.resolver';
import { MusicPlayerService } from './music-player.service';
import { WaveformService } from './waveform.service';

@Module({
  imports: [SharedModule, MusicTrackModule,],
  controllers: [AudioStreamingController],
  providers: [
    MusicPlayerResolver,
    MusicPlayerService,
    WaveformService,
    AudioAnalysisService,
  ],
  exports: [MusicPlayerService, WaveformService, AudioAnalysisService],
})
export class MusicPlayerModule { }
