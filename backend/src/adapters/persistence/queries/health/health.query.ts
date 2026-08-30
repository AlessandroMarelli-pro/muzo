import { Inject, Injectable } from '@nestjs/common';
import { HEALTH_STATUS, HealthInfo } from 'src/application/ports/dtos/HealthInfo';
import { IHealthQuery } from 'src/application/ports/queries/IHealthQuery';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';

@Injectable()
export class HealthQuery implements IHealthQuery {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async getHealthInfo(): Promise<HealthInfo> {
    const dbConnected = await this.prisma.checkConnection();

    return {
      status: dbConnected ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.UNHEALTHY,
      timestamp: Date.now(),
      database: {
        connected: dbConnected,
        status: dbConnected ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.UNHEALTHY,
        provider: 'prisma-postgresql',
      },
    };
  }
}
