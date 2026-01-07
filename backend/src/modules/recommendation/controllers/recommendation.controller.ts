import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  PlaylistRecommendationDto,
  RecommendationCriteria,
} from '../interfaces/recommendation.interface';
import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  RecommendationService,
} from '../services/recommendation.service';

@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Post('playlist')
  @HttpCode(HttpStatus.OK)
  async getPlaylistRecommendations(
    @Body() dto: PlaylistRecommendationDto,
    @Query('weights') weights?: string,
  ) {
    let criteria: RecommendationCriteria | undefined;

    if (weights) {
      try {
        const parsedWeights = JSON.parse(weights);
        criteria = {
          weights: parsedWeights,
          limit: dto.limit,
          excludeTrackIds: dto.excludeTrackIds,
        };
      } catch (error) {
        // Use default weights if parsing fails
        criteria = {
          weights: DEFAULT_RECOMMENDATION_WEIGHTS,
          limit: dto.limit,
          excludeTrackIds: dto.excludeTrackIds,
        };
      }
    }

    return this.recommendationService.getPlaylistRecommendations(dto, criteria);
  }

  @Get('sync/:trackId')
  @HttpCode(HttpStatus.OK)
  async syncTrackToElasticsearch(@Param('trackId') trackId: string) {
    await this.recommendationService.syncTrackToElasticsearch(trackId);
    return { message: 'Track synced to Elasticsearch successfully' };
  }

  @Post('test-genre-scoring/:playlistId')
  @HttpCode(HttpStatus.OK)
  async testGenreScoring(@Param('playlistId') playlistId: string) {
    return this.recommendationService.testGenreScoring(playlistId);
  }

  @Post('debug/:playlistId')
  @HttpCode(HttpStatus.OK)
  async debugRecommendationScores(
    @Param('playlistId') playlistId: string,
    @Query('includeUserBehavior') includeUserBehavior?: boolean,
    @Query('includeMetadata') includeMetadata?: boolean,
  ) {
    const criteria: RecommendationCriteria = {
      weights: DEFAULT_RECOMMENDATION_WEIGHTS,
      limit: 5,
      excludeTrackIds: [],
    };

    return this.recommendationService.debugRecommendationScores(
      playlistId,
      criteria,
    );
  }

  @Get('recreate-index')
  @HttpCode(HttpStatus.OK)
  async recreateIndex() {
    await this.recommendationService.recreateElasticsearchIndex();
    return { message: 'Elasticsearch index recreated successfully' };
  }

  @Post('update-mapping')
  @HttpCode(HttpStatus.OK)
  async updateMapping() {
    await this.recommendationService.updateElasticsearchMapping();
    return { message: 'Elasticsearch mapping updated successfully' };
  }

  @Get('sync-all')
  @HttpCode(HttpStatus.OK)
  async syncAllTracksToElasticsearch() {
    await this.recommendationService.syncAllTracksToElasticsearch();
    return { message: 'All tracks synced to Elasticsearch successfully' };
  }
}
