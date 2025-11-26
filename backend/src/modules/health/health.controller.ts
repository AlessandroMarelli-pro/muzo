import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async getHealth() {
    const dbConnected = await this.prismaService.checkConnection();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        status: dbConnected ? 'healthy' : 'unhealthy',
        provider: 'prisma-sqlite',
      },
    };
  }

  @Get('database')
  async getDatabaseHealth() {
    const dbConnected = await this.prismaService.checkConnection();

    return {
      connected: dbConnected,
      status: dbConnected ? 'healthy' : 'unhealthy',
      provider: 'prisma-sqlite',
      timestamp: new Date().toISOString(),
    };
  }
}
