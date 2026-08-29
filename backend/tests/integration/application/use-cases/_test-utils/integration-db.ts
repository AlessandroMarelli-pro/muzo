import { execSync } from 'child_process';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';

/**
 * Base connection used to create/drop per-test-run databases. Points at the
 * `postgres` maintenance database on the same server integration tests run
 * migrations against (docker-compose's `postgres` service, or a local
 * Postgres server when running without Docker).
 */
function adminConnectionString(): string {
  const base = process.env.TEST_DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      'Set TEST_DATABASE_ADMIN_URL or DATABASE_URL to a reachable Postgres server before running integration tests.',
    );
  }
  const url = new URL(base);
  url.pathname = '/postgres';
  return url.toString();
}

function testDatabaseName(): string {
  return `muzo_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Creates a PrismaClient connected to the given Postgres URL (Prisma v7 adapter).
 */
export function createIntegrationPrismaClient(dbUrl: string): PrismaClient {
  const adapter = new PrismaPg(dbUrl);
  return new PrismaClient({ adapter });
}

/**
 * Creates a temporary, isolated Postgres database and runs Prisma migrations
 * against it. Use for integration tests that need a real DB with the app
 * schema.
 *
 * Set process.env.DATABASE_URL before creating any module that uses Prisma.
 * Returns a cleanup function to drop the temporary database and disconnect.
 */
export async function setupIntegrationDb(): Promise<{
  dbPath: string;
  cleanup: () => Promise<void>;
}> {
  const dbName = testDatabaseName();
  const adminUrl = adminConnectionString();

  const adminClient = new Client({ connectionString: adminUrl });
  await adminClient.connect();
  await adminClient.query(`CREATE DATABASE "${dbName}"`);
  await adminClient.end();

  const testUrl = new URL(adminUrl);
  testUrl.pathname = `/${dbName}`;
  const dbUrl = testUrl.toString();

  process.env.DATABASE_URL = dbUrl;

  const backendRoot = path.resolve(__dirname, '../../../../..');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: dbUrl },
    cwd: backendRoot,
    stdio: 'inherit',
  });

  const cleanup = async () => {
    try {
      const dropClient = new Client({ connectionString: adminUrl });
      await dropClient.connect();
      // Terminate any lingering connections before dropping, or DROP DATABASE fails.
      await dropClient.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName],
      );
      await dropClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      await dropClient.end();
    } catch {
      // ignore -- best-effort cleanup
    }
  };

  return { dbPath: dbUrl, cleanup };
}
