import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { DatabaseConfig } from 'src/config';

/** Injection token for PrismaService so unit tests (Vitest) can provide a mock reliably. */
export const PRISMA_SERVICE = Symbol.for('PrismaService');

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService: ConfigService<{ database: DatabaseConfig }>) {
    const url = configService.get('database')?.url ?? 'file:./muzo.db';
    const adapter = new PrismaBetterSqlite3({ url });
    super({
      adapter,
      log: configService.get('database')?.logging ? ['query', 'info', 'warn', 'error'] : ['error'],
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
