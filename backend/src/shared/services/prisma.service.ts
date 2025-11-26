import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { DatabaseConfig } from '../../config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<DatabaseConfig>('database').url,
        },
      },
      log: configService.get<DatabaseConfig>('database').logging
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

  async runMigrations(): Promise<void> {
    try {
      // Prisma migrations are handled by the CLI
      console.log(
        'ℹ️ Prisma migrations should be run using: npx prisma migrate dev',
      );
    } catch (error) {
      console.error('❌ Migration info failed:', error);
      throw error;
    }
  }

  async resetDatabase(): Promise<void> {
    try {
      await this.$executeRaw`DELETE FROM sqlite_sequence`;
      console.log('✅ Database reset completed');
    } catch (error) {
      console.error('❌ Database reset failed:', error);
      throw error;
    }
  }
}
