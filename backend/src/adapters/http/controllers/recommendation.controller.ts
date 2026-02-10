import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { SyncAllTracksToElasticsearchUseCase } from 'src/application/use-cases';

@Controller('recommendations')
export class RecommendationController {
  constructor(
    private readonly syncAllTracksToElasticsearchUseCase: SyncAllTracksToElasticsearchUseCase,
  ) {}

  @Get('sync-all')
  @HttpCode(HttpStatus.OK)
  async syncTrackToElasticsearch(): Promise<{ message: string }> {
    await this.syncAllTracksToElasticsearchUseCase.execute();
    return { message: 'Track synced to Elasticsearch successfully' };
  }
}
