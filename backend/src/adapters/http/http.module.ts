import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UseCasesModule } from 'src/application/use-cases/use-cases.module';
import { HttpAuthGuard } from './context/http-auth.guard';
import { AudioStreamingController } from './controllers/audio-streaming.controller';
import { EmbeddingBackfillController } from './controllers/embedding-backfill.controller';
import { HealthController } from './controllers/health.controller';
import { HqAudioBatchProgressController } from './controllers/hq-audio-batch-progress.controller';
import { ImageController } from './controllers/image.controller';
import { OAuthRedirectController } from './controllers/oauth-redirect.controller';
import { RecommendationController } from './controllers/recommendation.controller';
import { ScanProgressController } from './controllers/scan-progress.controller';
import { ScanTracksByCriteriaController } from './controllers/scan-tracks-by-criteria.controller';

@Module({
  imports: [ConfigModule, UseCasesModule],
  controllers: [
    ImageController,
    AudioStreamingController,
    RecommendationController,
    HealthController,
    ScanProgressController,
    HqAudioBatchProgressController,
    ScanTracksByCriteriaController,
    OAuthRedirectController,
    EmbeddingBackfillController,
  ],
  providers: [HttpAuthGuard],
})
export class HttpModule {}
