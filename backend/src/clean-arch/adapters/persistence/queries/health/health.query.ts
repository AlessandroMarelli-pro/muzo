import { Injectable } from '@nestjs/common';
import {
  HEALTH_STATUS,
  HealthInfo,
} from 'src/clean-arch/application/ports/dtos/HealthInfo';
import { IHealthQuery } from 'src/clean-arch/application/ports/queries/IHealthQuery';
import { PrismaService } from 'src/clean-arch/infrastructure/database/prisma.service';

@Injectable()
export class HealthQuery implements IHealthQuery {
  constructor(private readonly prisma: PrismaService) {}

  async getHealthInfo(): Promise<HealthInfo> {
    const dbConnected = await this.prisma.checkConnection();

    return {
      status: dbConnected ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.UNHEALTHY,
      timestamp: Date.now(),
      database: {
        connected: dbConnected,
        status: dbConnected ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.UNHEALTHY,
        provider: 'prisma-sqlite',
      },
    };
  }
}
