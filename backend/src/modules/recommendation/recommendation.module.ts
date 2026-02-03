import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { RecommendationController } from './controllers/recommendation.controller';
import { ElasticsearchSyncService } from './services/elasticsearch-sync.service';
import { RecommendationService } from './services/recommendation.service';

@Module({
  imports: [SharedModule],
  providers: [RecommendationService, ElasticsearchSyncService],
  controllers: [RecommendationController],
  exports: [RecommendationService, ElasticsearchSyncService],
})
export class RecommendationModule {}
