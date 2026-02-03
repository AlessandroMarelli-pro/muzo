import { Inject, Injectable } from '@nestjs/common';
import { METRICS_QUERY, MetricsDto } from '../../ports/queries/IMetricsQuery';

import { IMetricsQuery } from '../../ports/queries/IMetricsQuery';

@Injectable()
export class GetHomeMetricsUseCase {
  constructor(
    @Inject(METRICS_QUERY)
    private readonly metricsQuery: IMetricsQuery,
  ) {}

  async execute(): Promise<MetricsDto> {
    return this.metricsQuery.getMetrics();
  }
}
