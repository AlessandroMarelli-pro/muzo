import { HealthInfo } from '../../ports/dtos/HealthInfo';
import { IHealthQuery } from '../../ports/queries/IHealthQuery';

export class HealthCheckUseCase {
  constructor(private readonly healthQuery: IHealthQuery) {}

  async execute(): Promise<HealthInfo> {
    return this.healthQuery.getHealthInfo();
  }
}
