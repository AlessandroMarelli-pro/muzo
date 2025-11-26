import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { RecommendationController } from './controllers/recommendation.controller';
import { UserRecommendationPreferencesController } from './controllers/user-recommendation-preferences.controller';
import { ElasticsearchSyncService } from './services/elasticsearch-sync.service';
import { RecommendationService } from './services/recommendation.service';
import { UserRecommendationPreferencesService } from './services/user-recommendation-preferences.service';

@Module({
  imports: [SharedModule],
  providers: [
    RecommendationService,
    UserRecommendationPreferencesService,
    ElasticsearchSyncService,
  ],
  controllers: [
    RecommendationController,
    UserRecommendationPreferencesController,
  ],
  exports: [
    RecommendationService,
    UserRecommendationPreferencesService,
    ElasticsearchSyncService,
  ],
})
export class RecommendationModule {}
