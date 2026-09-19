/**
 * One-time cleanup: a collation change under the persistent Postgres volume
 * corrupted `music_tracks_filePath_key` (amcheck: "item order invariant
 * violated"). While the index was broken, `upsertOne`'s existence lookup
 * missed rows that were really there, so the create branch fired and inserted
 * phantom duplicates -- and the INSERT succeeded because the same corruption
 * had removed the index entries that should have blocked it.
 *
 * For each duplicated filePath, keep the OLDEST row: it is the original that
 * accumulated playlist membership and play counts, while each phantom was
 * minted with a fresh uuid during the rescan and never acquired any.
 *
 * That "phantoms carry no data" assumption is load-bearing, so it is asserted
 * rather than trusted: if any row being dropped has a playlist link or a
 * non-zero listeningCount, nothing is deleted and the script exits non-zero.
 *
 * Every query sets enable_indexscan/enable_bitmapscan off -- the whole problem
 * is that the index cannot be trusted to find rows, so the planner must be
 * forced through the heap. Run this BEFORE reindexing: REINDEX on a unique
 * index fails while duplicates exist.
 *
 *   npx tsx prisma/scripts/cleanup-duplicate-tracks.ts          # dry run
 *   npx tsx prisma/scripts/cleanup-duplicate-tracks.ts --apply  # delete
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL ?? 'postgresql://muzo:muzo@localhost:5432/muzo';
const prisma = new PrismaClient({ adapter: new PrismaPg(url) });
const APPLY = process.argv.includes('--apply');

type Row = {
  id: string;
  filePath: string;
  createdAt: Date;
  analysisStatus: string;
  playlists: bigint;
  listeningCount: number;
};

async function main() {
  // The planner must not use the corrupt index to locate rows.
  await prisma.$executeRawUnsafe('SET enable_indexscan = off');
  await prisma.$executeRawUnsafe('SET enable_bitmapscan = off');

  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT m.id,
           m."filePath",
           m."createdAt",
           m."analysisStatus",
           (SELECT count(*) FROM playlist_tracks p WHERE p."trackId" = m.id) AS playlists,
           m."listeningCount"
      FROM music_tracks m
     WHERE m."filePath" IN (
             SELECT "filePath" FROM music_tracks GROUP BY 1 HAVING count(*) > 1
           )
     ORDER BY m."filePath", m."createdAt"
  `);

  if (rows.length === 0) {
    console.log('No duplicate filePaths found. Nothing to do.');
    return;
  }

  const byPath = new Map<string, Row[]>();
  for (const row of rows) {
    const bucket = byPath.get(row.filePath) ?? [];
    bucket.push(row);
    byPath.set(row.filePath, bucket);
  }

  const toDelete: Row[] = [];
  const keepers: Row[] = [];
  const violations: string[] = [];

  for (const [filePath, group] of byPath) {
    // Already ordered by createdAt ASC, so the first row is the original.
    const [keep, ...drop] = group;
    keepers.push(keep);

    console.log(`\n${filePath}`);
    console.log(
      `  KEEP  ${keep.id}  ${keep.createdAt.toISOString()}  ${keep.analysisStatus}  ` +
        `playlists=${keep.playlists}  plays=${keep.listeningCount}`,
    );

    for (const row of drop) {
      const hasData = row.playlists > 0n || row.listeningCount > 0;
      console.log(
        `  DROP  ${row.id}  ${row.createdAt.toISOString()}  ${row.analysisStatus}  ` +
          `playlists=${row.playlists}  plays=${row.listeningCount}` +
          (hasData ? '   <-- CARRIES DATA' : ''),
      );
      if (hasData) {
        violations.push(
          `${row.id} (${filePath}): playlists=${row.playlists}, plays=${row.listeningCount}`,
        );
      }
      toDelete.push(row);
    }
  }

  if (violations.length > 0) {
    console.error(
      `\nABORT: ${violations.length} row(s) marked for deletion carry real data.\n` +
        violations.map((v) => `  - ${v}`).join('\n') +
        '\n\nKeeping the oldest row would discard user history here. Resolve these by ' +
        'hand (merge the playlist links and play counts onto the keeper first).',
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n${byPath.size} duplicated path(s); ${toDelete.length} phantom row(s) to delete.`,
  );

  if (!APPLY) {
    console.log('Dry run -- nothing deleted. Re-run with --apply to execute.');
    return;
  }

  const ids = toDelete.map((r) => r.id);

  // All 7 FKs to music_tracks are ON DELETE CASCADE, so dependent rows go with them.
  const deleted = await prisma.$executeRawUnsafe(
    `DELETE FROM music_tracks WHERE id = ANY($1::text[])`,
    ids,
  );
  console.log(`Deleted ${deleted} row(s).`);

  // The surviving rows may be stuck in PROCESSING because the analysis that
  // would have completed them was written to the phantom instead.
  const stuck = keepers.filter((k) => k.analysisStatus === 'PROCESSING').map((k) => k.id);
  if (stuck.length > 0) {
    const reset = await prisma.$executeRawUnsafe(
      `UPDATE music_tracks
          SET "analysisStatus" = 'PENDING', "analysisError" = NULL, "analysisStartedAt" = NULL
        WHERE id = ANY($1::text[])`,
      stuck,
    );
    console.log(`Reset ${reset} keeper(s) from PROCESSING to PENDING for re-analysis.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
