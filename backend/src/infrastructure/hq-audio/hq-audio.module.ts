import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  HQ_AUDIO_ACQUIRER,
  HQ_AUDIO_ACQUIRER_SOCKSEEK_ONLY,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { ThirdPartySyncInfrastructureModule } from '../external-services/third-party-sync/third-party-sync.module';
import { CompositeHqAudioAcquirer } from './composite-hq-audio.acquirer';
import { SockseekAcquirer } from './sockseek.acquirer';
import { TidalDlAcquirer } from './tidal-dl.acquirer';

@Module({
  imports: [ConfigModule, ThirdPartySyncInfrastructureModule],
  providers: [
    TidalDlAcquirer,
    SockseekAcquirer,
    CompositeHqAudioAcquirer,
    { provide: HQ_AUDIO_ACQUIRER, useExisting: CompositeHqAudioAcquirer },
    { provide: HQ_AUDIO_ACQUIRER_SOCKSEEK_ONLY, useExisting: SockseekAcquirer },
  ],
  exports: [HQ_AUDIO_ACQUIRER, HQ_AUDIO_ACQUIRER_SOCKSEEK_ONLY],
})
export class HqAudioInfrastructureModule {}
