import { Controller, Get } from '@nestjs/common';
import { HealthCheckUseCase } from 'src/clean-arch/application/use-cases/health/HealthCheck';

@Controller('health')
export class HealthController {
  constructor(private readonly getHealthUseCase: HealthCheckUseCase) {}

  @Get()
  async getHealth() {
    return this.getHealthUseCase.execute();
  }
}
