import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AI_SERVICE_POOL } from 'src/application/ports/infrastructure/IAiServicePool';
import { AUDIO_ANALYSIS_STRUCTURE } from 'src/application/ports/infrastructure/IAudioAnalysisStructure';
import { HQ_AUDIO_ENHANCER } from 'src/application/ports/infrastructure/IHqAudioEnhancer';
import { HQ_AUDIO_VERIFIER } from 'src/application/ports/infrastructure/IHqAudioVerifier';
import { AiAudioAnalysisAdapter } from './ai-audio-analysis.adapter';
import { AiAudioEnhancementAdapter } from './ai-audio-enhancement.adapter';
import { AiAudioLosslessVerifierAdapter } from './ai-audio-lossless-verifier.adapter';
import { AiServerPoolAdapter } from './ai-server-pool.adapter';

// AI_SERVICE_SETTINGS_REPOSITORY comes from the (@Global) persistence module -- no import needed
// here, same as PrismaService/DatabaseModule.

@Global()
@Module({
  imports: [ConfigModule, HttpModule],
  providers: [
    {
      provide: AI_SERVICE_POOL,
      useClass: AiServerPoolAdapter,
    },
    {
      provide: AUDIO_ANALYSIS_STRUCTURE,
      useClass: AiAudioAnalysisAdapter,
    },
    {
      provide: HQ_AUDIO_ENHANCER,
      useClass: AiAudioEnhancementAdapter,
    },
    {
      provide: HQ_AUDIO_VERIFIER,
      useClass: AiAudioLosslessVerifierAdapter,
    },
  ],
  exports: [
    AI_SERVICE_POOL,
    AUDIO_ANALYSIS_STRUCTURE,
    HQ_AUDIO_ENHANCER,
    HQ_AUDIO_VERIFIER,
  ],
})
export class AiModule {}
