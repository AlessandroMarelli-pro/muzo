import * as fs from 'fs/promises';
import * as path from 'path';
import { normalizeForMatch } from './match';

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
 * sockseek writes `<outputDir>/<queryCsvBasename>/_index.csv` with one final row
 * per input track (same order as the query CSV): columns
 * `filepath,artist,album,title,length,tracktype,state,failurereason`.
 * `state === '1'` with a non-empty `filepath` is a completed download.
 *
 * Returns `{ rowIndex -> filepath }` (0-based, matching the query CSV data-row
 * order) for every downloaded row. An absent file returns an empty map.
 */
export function parseIndexCsvDownloads(contents: string): Map<number, string> {
  const result = new Map<number, string>();
  for (const row of parseIndexCsvRows(contents)) {
    if (row.state === 'downloaded' && row.filepath) {
      result.set(row.index, row.filepath);
    }
  }
  return result;
}

export interface IndexCsvRow {
  /** 0-based, matching the query CSV data-row order. */
  index: number;
  filepath: string;
  artist: string;
  title: string;
  /** downloaded (`1`) | failed (`2`) | pending (`0`/other). */
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
      index: i - 1,
      filepath: cols[0],
      artist: cols[1],
      title: cols[3],
      state: stateCol === '1' ? 'downloaded' : stateCol === '2' ? 'failed' : 'pending',
      failureReason: cols[7],
    });
  }
  return rows;
}

/** The directory sockseek creates for a run's `_index.csv` (and partials). */
export function indexCsvDir(queryCsvPath: string, outputDir: string): string {
  return path.join(outputDir, path.basename(queryCsvPath, path.extname(queryCsvPath)));
}

export function indexCsvPath(queryCsvPath: string, outputDir: string): string {
  return path.join(indexCsvDir(queryCsvPath, outputDir), '_index.csv');
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
  queryCsvPath: string,
  outputDir: string,
): Promise<Map<number, string>> {
  const contents = await readIndexCsvContents(indexCsvPath(queryCsvPath, outputDir));
  return contents ? parseIndexCsvDownloads(contents) : new Map();
}

export async function readIndexCsvRowsAt(indexCsvFilePath: string): Promise<IndexCsvRow[]> {
  const contents = await readIndexCsvContents(indexCsvFilePath);
  return contents ? parseIndexCsvRows(contents) : [];
}

/**
 * Drops a trailing "feat./ft./featuring/with ..." segment — sockseek writes its
 * `_index.csv` with `--remove-ft` applied, so `Faithless feat. Dido` lands as
 * `faithless`. Applied to both sides of {@link indexRowMatchKey} so the DB
 * track's stored artist still cross-matches.
 */
function stripFeatured(value: string): string {
  return value.replace(/\s*[([]?\s*(feat\.?|ft\.?|featuring)\s+.*$/i, '').trim();
}

/** `artist|title` match key for a downloaded row, robust to sockseek's own
 *  normalisation (`--remove-ft` etc.) and CSV quoting. */
export function indexRowMatchKey(artist: string, title: string): string {
  return `${normalizeForMatch(stripFeatured(artist))}|${normalizeForMatch(title)}`;
}

/**
 * Scans `outputDir` for every prior batch's `_index.csv` (under a
 * `sockseek-batch-<id>` dir) and returns each track it downloaded, keyed by
 * {@link indexRowMatchKey}. Lets a
 * brand-new batch (new random `batchId`, hence a new scratch dir) still adopt files an
 * earlier run downloaded but never persisted. Newer dirs win on key collision.
 */
export async function readAllPriorIndexCsvDownloads(
  outputDir: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
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
      if (row.state === 'downloaded' && row.filepath) {
        result.set(indexRowMatchKey(row.artist, row.title), row.filepath);
      }
    }
  }
  return result;
}

export async function removeIndexCsvDir(
  queryCsvPath: string,
  outputDir: string,
): Promise<void> {
  await fs.rm(indexCsvDir(queryCsvPath, outputDir), { recursive: true, force: true });
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
