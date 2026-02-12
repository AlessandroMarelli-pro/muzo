import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Sets up a temporary SQLite database file and runs Prisma migrations.
 * Use for integration tests that need a real DB with the app schema.
 *
 * Set process.env.DATABASE_URL before creating any module that uses Prisma.
 * Returns a cleanup function to delete the temp file and disconnect.
 */
export async function setupIntegrationDb(): Promise<{
  dbPath: string;
  cleanup: () => Promise<void>;
}> {
  const tmpDir = os.tmpdir();
  const dbPath = path.join(tmpDir, `muzo-integration-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const dbUrl = `file:${dbPath}`;

  process.env.DATABASE_URL = dbUrl;

  const backendRoot = path.resolve(__dirname, '../../../../..');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: dbUrl },
    cwd: backendRoot,
    stdio: 'inherit',
  });

  const cleanup = async () => {
    try {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    } catch {
      // ignore
    }
  };

  return { dbPath, cleanup };
}
