/**
 * One-time backfill: sockseek writes an _index.csv next to its downloads
 * (artist, title, filepath, ...) for every song it successfully found on
 * Soulseek. This matches each CSV row against music_tracks by normalized
 * (lowercased, trimmed) originalArtist/originalTitle and sets hqAudioPath
 * to the downloaded file's path, so tracks acquired via the sockseek CLI
 * (outside the app's own download flow) are reflected as HQ.
 *
 * Run once, manually:
 *   npx tsx prisma/scripts/backfill-hq-audio-path-from-sockseek-index.ts <path-to-_index.csv>
 */
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const dbPath = path.resolve(__dirname, '..', 'muzo.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

type IndexRow = {
  filepath: string;
  artist: string;
  title: string;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function parseCsv(csvPath: string): IndexRow[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  const header = lines[0].split(',');
  const filepathIdx = header.indexOf('filepath');
  const artistIdx = header.indexOf('artist');
  const titleIdx = header.indexOf('title');

  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    return {
      filepath: cols[filepathIdx],
      artist: cols[artistIdx],
      title: cols[titleIdx],
    };
  });
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: npx tsx prisma/scripts/backfill-hq-audio-path-from-sockseek-index.ts <path-to-_index.csv>');
    process.exitCode = 1;
    return;
  }

  const rows = parseCsv(csvPath);
  console.log(`Read ${rows.length} row(s) from ${csvPath}`);

  const tracks = await prisma.musicTrack.findMany({
    select: { id: true, originalArtist: true, originalTitle: true, hqAudioPath: true },
  });
  const byArtistTitle = new Map<string, (typeof tracks)[number][]>();
  for (const track of tracks) {
    if (!track.originalArtist || !track.originalTitle) continue;
    const key = `${normalize(track.originalArtist)}::${normalize(track.originalTitle)}`;
    const bucket = byArtistTitle.get(key) ?? [];
    bucket.push(track);
    byArtistTitle.set(key, bucket);
  }

  let updatedCount = 0;
  let missingFileCount = 0;
  let notFoundCount = 0;
  let ambiguousCount = 0;

  for (const row of rows) {
    if (!fs.existsSync(row.filepath)) {
      console.warn(`Skipping (file missing on disk): ${row.filepath}`);
      missingFileCount += 1;
      continue;
    }

    const key = `${normalize(row.artist)}::${normalize(row.title)}`;
    const matches = byArtistTitle.get(key) ?? [];

    if (matches.length === 0) {
      console.warn(`No DB match for artist="${row.artist}" title="${row.title}"`);
      notFoundCount += 1;
      continue;
    }
    if (matches.length > 1) {
      console.warn(
        `Ambiguous match (${matches.length} tracks) for artist="${row.artist}" title="${row.title}", skipping`,
      );
      ambiguousCount += 1;
      continue;
    }

    const track = matches[0];
    if (track.hqAudioPath) {
      continue;
    }

    await prisma.musicTrack.update({
      where: { id: track.id },
      data: { hqAudioPath: row.filepath },
    });
    updatedCount += 1;
    console.log(`Set hqAudioPath for "${row.artist} - ${row.title}" -> ${row.filepath}`);
  }

  console.log(
    `Done. Updated ${updatedCount} track(s). Missing files: ${missingFileCount}. Not found in DB: ${notFoundCount}. Ambiguous: ${ambiguousCount}.`,
  );
}

main()
  .catch((error) => {
    console.error('Backfill script failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
