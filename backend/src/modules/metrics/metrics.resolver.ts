import { Query, Resolver } from '@nestjs/graphql';
import { LibraryMetrics } from './metrics.model';
import { MetricsService } from './metrics.service';

@Resolver()
export class MetricsResolver {
  constructor(private readonly metricsService: MetricsService) {}

  @Query(() => LibraryMetrics)
  async libraryMetrics(): Promise<LibraryMetrics> {
    return this.metricsService.getLibraryMetrics();
  }
}
