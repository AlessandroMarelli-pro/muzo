import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AI_SERVICE_POOL } from 'src/application/ports/infrastructure/IAiServicePool';
import { AUDIO_ANALYSIS_STRUCTURE } from 'src/application/ports/infrastructure/IAudioAnalysisStructure';
import { AiAudioAnalysisAdapter } from './ai-audio-analysis.adapter';
import { AiServerPoolAdapter } from './ai-server-pool.adapter';

@Global()
@Module({
  imports: [ConfigModule, HttpModule, BullModule.registerQueue({ name: 'library-scan' })],
  providers: [
    {
      provide: AI_SERVICE_POOL,
      useClass: AiServerPoolAdapter,
    },
    {
      provide: AUDIO_ANALYSIS_STRUCTURE,
      useClass: AiAudioAnalysisAdapter,
    },
  ],
  exports: [AI_SERVICE_POOL, AUDIO_ANALYSIS_STRUCTURE],
})
export class AiModule {}
