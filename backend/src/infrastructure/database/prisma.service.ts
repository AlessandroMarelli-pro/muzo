import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { DatabaseConfig } from 'src/config';

/** Injection token for PrismaService so unit tests (Vitest) can provide a mock reliably. */
export const PRISMA_SERVICE = Symbol.for('PrismaService');

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService: ConfigService<{ database: DatabaseConfig }>) {
    const url =
      configService.get('database')?.url ?? 'postgresql://muzo:muzo@localhost:5432/muzo';
    const adapter = new PrismaPg(url);
    super({
      adapter,
      log: configService.get('database')?.logging ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Prisma database connection established');
      await this.warnOnCollationDrift();
    } catch (error) {
      console.error('❌ Prisma database connection failed:', error);
      throw error;
    }
  }

  /**
   * The Postgres image once moved under a persistent volume and brought a
   * different glibc with it. Text sort order changed beneath the existing
   * B-tree indexes, so `music_tracks_filePath_key` silently stopped matching
   * rows that were really there: the scanner's upsert took its create branch
   * and inserted duplicate tracks, and the constraint that should have blocked
   * them was itself too corrupt to fire. Nothing surfaced for ~3 weeks.
   *
   * Postgres already records the collation version it built indexes with, so
   * comparing it to the running one turns that silent failure into a log line.
   * Warn only -- a mismatch means "reindex before trusting unique lookups", not
   * "refuse to boot" -- and never let the check itself take the app down.
   */
  private async warnOnCollationDrift(): Promise<void> {
    try {
      const [row] = await this.$queryRaw<{ recorded: string | null; actual: string | null }[]>`
        SELECT datcollversion AS recorded,
               pg_database_collation_actual_version(oid) AS actual
          FROM pg_database
         WHERE datname = current_database()
      `;
      if (row?.recorded && row.actual && row.recorded !== row.actual) {
        console.error(
          `🚨 Postgres collation drift: indexes were built with ${row.recorded}, ` +
            `server now provides ${row.actual}. Text indexes may be silently corrupt ` +
            `(unique constraints can stop matching existing rows). Run ` +
            `REINDEX DATABASE, then ALTER DATABASE ... REFRESH COLLATION VERSION.`,
        );
      }
    } catch (error) {
      console.warn('Collation drift check skipped:', (error as Error).message);
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
