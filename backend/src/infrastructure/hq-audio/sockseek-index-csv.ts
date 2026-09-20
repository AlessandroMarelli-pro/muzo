import * as fs from 'fs/promises';
import * as path from 'path';
import type { MusicTrackId } from 'src/kernel/ids';

/**
 * A `MusicTrackId` is `MusicTrack:<uuid>` (see `kernel/ids/factory.ts`), and the
 * `:` is not safe in a filename — illegal on Windows, and historically a path
 * separator on macOS, which also means sockseek's own `--invalid-replace-str`
 * may rewrite it. So the id is written into the filename with the prefix
 * dropped, leaving the bare uuid, and restored on the way back.
 */
const TRACK_ID_PREFIX = 'MusicTrack:';

/** The filename-safe form of a `MusicTrackId`, written into the CSV `Id` column. */
export function trackIdToFileToken(trackId: string): string {
  return trackId.startsWith(TRACK_ID_PREFIX)
    ? trackId.slice(TRACK_ID_PREFIX.length)
    : trackId;
}

/**
 * The `MusicTrackId` sockseek encodes into every downloaded filename via
 * `--name-format '{uri}__…'` (see `writeBatchInputCsv`'s `Id` column).
 *
 * This is the *only* reliable way to map a downloaded file back to its track.
 * `_index.csv` row position cannot be used: sockseek dedupes index entries by
 * `artist\nalbum\ntitle\nlength`, so two tracks with identical metadata collapse
 * into a single row and shift the index of every row after them.
 *
 * Accepts the `MusicTrack:` prefix too, so files written before the prefix was
 * stripped are still attributed rather than silently orphaned.
 */
export function trackIdFromPath(filePath: string): MusicTrackId | null {
  const match =
    /^(?:MusicTrack:)?([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})__/.exec(
      path.basename(filePath),
    );
  return match ? (`${TRACK_ID_PREFIX}${match[1]}` as MusicTrackId) : null;
}

/** Minimal RFC-4180-ish CSV line parser (handles quoted fields containing commas). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  out.push(field);
  return out;
}

/**
 * sockseek writes `_index.csv` (we pin its location with `--index-path`) with
 * columns `filepath,artist,album,title,length,tracktype,state,failurereason`.
 *
 * Returns `{ trackId -> filepath }` for every downloaded row, reading the id out
 * of the filename (see {@link trackIdFromPath}). Rows whose filename carries no
 * id — e.g. written by an older build — are skipped rather than guessed at.
 */
export function parseIndexCsvDownloads(
  contents: string,
  /** Directory the index file lives in — sockseek writes `./…` paths relative to it. */
  baseDir?: string,
): Map<MusicTrackId, string> {
  const result = new Map<MusicTrackId, string>();
  for (const row of parseIndexCsvRows(contents)) {
    if (row.state !== 'downloaded' || !row.filepath) {
      continue;
    }
    const trackId = trackIdFromPath(row.filepath);
    if (trackId) {
      result.set(trackId, baseDir ? path.resolve(baseDir, row.filepath) : row.filepath);
    }
  }
  return result;
}

export interface IndexCsvRow {
  filepath: string;
  artist: string;
  title: string;
  /**
   * sockseek's `JobStateOld`: `0` Pending, `1` Done, `2` Failed,
   * `3` AlreadyExists, `4` NotFoundLastTime. `3` means the file is already on
   * disk and should be adopted, so it counts as downloaded; `4` is a prior miss
   * that sockseek declined to re-search, so it counts as failed.
   */
  state: 'downloaded' | 'failed' | 'pending';
  failureReason: string;
}

/** Full per-row view of `_index.csv` — downloaded, failed, and still-pending. */
export function parseIndexCsvRows(contents: string): IndexCsvRow[] {
  const rows: IndexCsvRow[] = [];
  const lines = contents.split('\n').filter((l) => l.trim());
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 8) {
      continue;
    }
    const stateCol = cols[6];
    rows.push({
      filepath: cols[0],
      artist: cols[1],
      title: cols[3],
      state:
        stateCol === '1' || stateCol === '3'
          ? 'downloaded'
          : stateCol === '2' || stateCol === '4'
            ? 'failed'
            : 'pending',
      failureReason: cols[7],
    });
  }
  return rows;
}

/**
 * A batch's own directory: holds our `_input.csv` manifest, sockseek's
 * `_index.csv`, and the downloads. Passed explicitly as `-p` and
 * `--index-path` rather than being inferred from the query-CSV basename.
 */
export function batchDir(batchId: string, outputDir: string): string {
  const safeId = batchId.replace(/[^A-Za-z0-9._-]/g, '_');
  return path.join(outputDir, `sockseek-batch-${safeId}`);
}

export function indexCsvPath(batchId: string, outputDir: string): string {
  return path.join(batchDir(batchId, outputDir), '_index.csv');
}

export function inputCsvPath(batchId: string, outputDir: string): string {
  return path.join(batchDir(batchId, outputDir), '_input.csv');
}

async function readIndexCsvContents(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function readIndexCsvDownloads(
  batchId: string,
  outputDir: string,
): Promise<Map<MusicTrackId, string>> {
  const csvPath = indexCsvPath(batchId, outputDir);
  const contents = await readIndexCsvContents(csvPath);
  return contents ? parseIndexCsvDownloads(contents, path.dirname(csvPath)) : new Map();
}

/**
 * Rows of the `_index.csv` at `indexCsvFilePath`, with every `filepath`
 * resolved to an absolute path.
 *
 * sockseek writes paths relative to the index file's own directory
 * (`./Artist - Title.flac`) whenever the download sits under it, so a row's
 * `filepath` is not usable as-is: it only resolves correctly from that
 * directory, and `hqAudioPath` must be absolute to survive in the DB.
 */
export async function readIndexCsvRowsAt(indexCsvFilePath: string): Promise<IndexCsvRow[]> {
  const contents = await readIndexCsvContents(indexCsvFilePath);
  if (!contents) {
    return [];
  }
  const dir = path.dirname(indexCsvFilePath);
  return parseIndexCsvRows(contents).map((row) =>
    row.filepath ? { ...row, filepath: path.resolve(dir, row.filepath) } : row,
  );
}

/**
 * Scans `outputDir` for every prior batch's `_index.csv` and returns each track
 * it downloaded, keyed by `MusicTrackId`. Lets a brand-new batch (new random
 * `batchId`, hence a new dir) still adopt files an earlier run downloaded but
 * never persisted. Newer dirs win on collision.
 *
 * Keyed off the id embedded in the filename, so unlike the artist+title matching
 * this replaces, it cannot adopt one track's file onto another track.
 */
export async function readAllPriorIndexCsvDownloads(
  outputDir: string,
): Promise<Map<MusicTrackId, string>> {
  const result = new Map<MusicTrackId, string>();
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(outputDir, { withFileTypes: true });
  } catch {
    return result;
  }

  const dirs: { name: string; mtimeMs: number }[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^sockseek-batch-/.test(entry.name)) {
      continue;
    }
    try {
      const stat = await fs.stat(path.join(outputDir, entry.name));
      dirs.push({ name: entry.name, mtimeMs: stat.mtimeMs });
    } catch {
      // ignore — best effort
    }
  }
  // Oldest first so newer runs' downloads overwrite on key collision.
  dirs.sort((a, b) => a.mtimeMs - b.mtimeMs);

  for (const dir of dirs) {
    const rows = await readIndexCsvRowsAt(path.join(outputDir, dir.name, '_index.csv'));
    for (const row of rows) {
      if (row.state !== 'downloaded' || !row.filepath) {
        continue;
      }
      const trackId = trackIdFromPath(row.filepath);
      if (trackId) {
        result.set(trackId, row.filepath);
      }
    }
  }
  return result;
}

export async function removeBatchDir(batchId: string, outputDir: string): Promise<void> {
  await fs.rm(batchDir(batchId, outputDir), { recursive: true, force: true });
}

/**
 * Deletes leftover `sockseek-*query-*` and `sockseek-batch-*` scratch dirs under
 * `outputDir` that are older than `maxAgeMs` — housekeeping so past runs don't
 * accumulate (a `sockseek-batch-*` dir is kept between runs as the cross-run
 * adoption source, so it needs age-based pruning). Never throws.
 */
export async function pruneStaleQueryDirs(
  outputDir: string,
  maxAgeMs: number,
): Promise<number> {
  let removed = 0;
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(outputDir, { withFileTypes: true });
  } catch {
    return 0;
  }
  const cutoff = Date.now() - maxAgeMs;
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^sockseek-(.*query-|batch-)/.test(entry.name)) {
      continue;
    }
    const dir = path.join(outputDir, entry.name);
    try {
      const stat = await fs.stat(dir);
      if (stat.mtimeMs < cutoff) {
        await fs.rm(dir, { recursive: true, force: true });
        removed++;
      }
    } catch {
      // ignore — best effort
    }
  }
  return removed;
}
