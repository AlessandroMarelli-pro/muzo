/**
 * One-time backfill: tracks whose file on disk is already lossless (.flac/.wav,
 * or a probed format of flac/wav) don't need to go through HQ acquisition —
 * the file itself IS the HQ copy. This mirrors the "already HQ" check in
 * AcquireHqAudioUseCase (src/application/use-cases/music-track/AcquireHqAudio.ts)
 * so tracks scanned before that check existed get hqAudioPath set retroactively.
 *
 * Run once, manually:
 *   npx tsx prisma/scripts/backfill-hq-audio-path-from-lossless-files.ts
 */
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';

const dbPath = path.resolve(__dirname, '..', 'muzo.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const LOSSLESS_EXTENSIONS = new Set(['flac', 'wav']);

function isLossless(filePath: string, format: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext && LOSSLESS_EXTENSIONS.has(ext)) {
    return true;
  }
  return LOSSLESS_EXTENSIONS.has(format.toLowerCase());
}

async function main() {
  const candidates = await prisma.musicTrack.findMany({
    where: { hqAudioPath: null },
    select: { id: true, filePath: true, format: true },
  });

  const toUpdate = candidates.filter((track) => isLossless(track.filePath, track.format));

  console.log(
    `Found ${candidates.length} track(s) without hqAudioPath, ${toUpdate.length} are already lossless.`,
  );

  let updatedCount = 0;
  for (const track of toUpdate) {
    await prisma.musicTrack.update({
      where: { id: track.id },
      data: { hqAudioPath: track.filePath },
    });
    updatedCount += 1;
  }

  console.log(`Done. Set hqAudioPath on ${updatedCount} track(s).`);
}

main()
  .catch((error) => {
    console.error('Backfill script failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
