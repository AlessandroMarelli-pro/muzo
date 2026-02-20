import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  RecreateElasticsearchIndexUseCase,
  SyncAllTracksToElasticsearchUseCase,
} from 'src/application/use-cases';

@Controller('recommendations')
export class RecommendationController {
  constructor(
    private readonly syncAllTracksToElasticsearchUseCase: SyncAllTracksToElasticsearchUseCase,
    private readonly recreateIndexUseCase: RecreateElasticsearchIndexUseCase,
  ) {}

  @Get('sync-all')
  @HttpCode(HttpStatus.OK)
  async syncTrackToElasticsearch(): Promise<{ message: string }> {
    await this.syncAllTracksToElasticsearchUseCase.execute();
    return { message: 'Track synced to Elasticsearch successfully' };
  }

  @Get('recreate-index')
  @HttpCode(HttpStatus.OK)
  async recreateIndex(): Promise<{ message: string }> {
    await this.recreateIndexUseCase.execute();
    return { message: 'Index recreated successfully' };
  }
}
