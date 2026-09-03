import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HQ_AUDIO_ACQUIRER } from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { HQ_AUDIO_TAGGER } from 'src/application/ports/infrastructure/IHqAudioTagger';
import { ThirdPartySyncInfrastructureModule } from '../external-services/third-party-sync/third-party-sync.module';
import { CompositeHqAudioAcquirer } from './composite-hq-audio.acquirer';
import { DeezerAcquirer } from './deezer.acquirer';
import { HqAudioTaggerAdapter } from './hq-audio-tagger.adapter';
import { QobuzAcquirer } from './qobuz.acquirer';
import { SockseekAcquirer } from './sockseek.acquirer';
import { TidalDlAcquirer } from './tidal-dl.acquirer';

@Module({
  imports: [ConfigModule, ThirdPartySyncInfrastructureModule],
  providers: [
    TidalDlAcquirer,
    QobuzAcquirer,
    DeezerAcquirer,
    SockseekAcquirer,
    CompositeHqAudioAcquirer,
    { provide: HQ_AUDIO_ACQUIRER, useExisting: CompositeHqAudioAcquirer },
    { provide: HQ_AUDIO_TAGGER, useClass: HqAudioTaggerAdapter },
  ],
  exports: [
    HQ_AUDIO_ACQUIRER,
    HQ_AUDIO_TAGGER,
    SockseekAcquirer,
    TidalDlAcquirer,
    QobuzAcquirer,
    DeezerAcquirer,
  ],
})
export class HqAudioInfrastructureModule {}
