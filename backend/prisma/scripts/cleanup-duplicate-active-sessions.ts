/**
 * One-time cleanup: before this migration, nothing enforced "one active
 * scan session per user", so a given createdById may have accumulated
 * multiple SCANNING/ANALYZING rows. For each affected user, keep the most
 * recently started active session and mark the rest as ERROR so the new
 * "reuse the active session" logic reflects a clean invariant instead of
 * silently masking pre-existing duplicates.
 *
 * Run once, manually, after applying the add_scan_session_library_id migration:
 *   npx tsx prisma/scripts/cleanup-duplicate-active-sessions.ts
 */
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';

const dbPath = path.resolve(__dirname, '..', 'muzo.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const ACTIVE_STATUSES = ['SCANNING', 'ANALYZING'] as const;

async function main() {
  const activeSessions = await prisma.scanSession.findMany({
    where: { status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { startedAt: 'desc' },
  });

  const byUser = new Map<string, typeof activeSessions>();
  for (const session of activeSessions) {
    const bucket = byUser.get(session.createdById) ?? [];
    bucket.push(session);
    byUser.set(session.createdById, bucket);
  }

  let supersededCount = 0;
  for (const [createdById, sessions] of byUser) {
    if (sessions.length <= 1) continue;
    const [keep, ...superseded] = sessions;
    console.log(
      `User ${createdById}: keeping session ${keep.sessionId} (started ${keep.startedAt.toISOString()}), superseding ${superseded.length} other(s)`,
    );
    for (const session of superseded) {
      await prisma.scanSession.update({
        where: { id: session.id },
        data: {
          status: 'ERROR',
          errorMessage: 'Superseded by session-management cleanup',
          completedAt: new Date(),
        },
      });
      supersededCount += 1;
    }
  }

  console.log(`Done. Superseded ${supersededCount} duplicate active session(s).`);
}

main()
  .catch((error) => {
    console.error('Cleanup script failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
