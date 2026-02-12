import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { DatabaseConfig } from 'src/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly configService: ConfigService<{ database: DatabaseConfig }>,
  ) {
    super({
      datasources: {
        db: {
          url: configService.get('database')?.url ?? 'file:./muzo.db',
        },
      },
      log: configService.get('database')?.logging
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Prisma database connection established');
    } catch (error) {
      console.error('❌ Prisma database connection failed:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔌 Prisma database connection closed');
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database connection check failed:', error);
      return false;
    }
  }
}
