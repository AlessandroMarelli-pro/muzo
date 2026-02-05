import { Injectable } from '@nestjs/common';
import { MetricsDto } from '../../ports/queries/IMetricsQuery';

import { IMetricsQuery } from '../../ports/queries/IMetricsQuery';

@Injectable()
export class GetHomeMetricsUseCase {
  constructor(private readonly metricsQuery: IMetricsQuery) {}

  async execute(): Promise<MetricsDto> {
    return this.metricsQuery.getMetrics();
  }
}
