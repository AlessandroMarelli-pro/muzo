import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import { DatabaseConfig } from 'src/config';

/** Default DB path: backend/prisma/muzo.db (resolved from this file's location so it does not depend on cwd). */
const defaultDbPath = path.resolve(__dirname, '..', '..', '..', 'prisma', 'muzo.db');

/** Injection token for PrismaService so unit tests (Vitest) can provide a mock reliably. */
export const PRISMA_SERVICE = Symbol.for('PrismaService');

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService: ConfigService<{ database: DatabaseConfig }>) {
    const configured = configService.get('database')?.url;
const relativeDefault = 'file:./prisma/muzo.db';
const url = configured && configured !== relativeDefault ? configured : `file:${defaultDbPath}`;
    // timeout: how long better-sqlite3 waits (retrying internally) for a write lock held by
    // another connection/transaction before throwing SQLITE_BUSY. The default (5000ms) can be
    // too short under concurrent BullMQ workers all writing to the same scan_sessions row;
    // raise it so transient contention resolves via waiting instead of surfacing as an error.
    const adapter = new PrismaBetterSqlite3({ url, timeout: 15000 });
    super({
      adapter,
      log: configService.get('database')?.logging ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      // WAL mode lets readers (e.g. an external DB browser tool with a table open, or another
      // connection) coexist with writers instead of blocking them, unlike the default
      // rollback-journal mode where any writer takes an exclusive lock on the whole file for
      // the duration of its transaction. This is the actual fix for the SQLITE_BUSY /
      // "database is locked" errors seen under concurrent access -- the `timeout` option above
      // only makes the app wait longer for a lock, it doesn't stop a long-lived external reader
      // from holding one.
      await this.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
      await this.$queryRawUnsafe('PRAGMA busy_timeout=15000;');
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
