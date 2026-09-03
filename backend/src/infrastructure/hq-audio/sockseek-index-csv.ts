import * as fs from 'fs/promises';
import * as path from 'path';

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
  const lines = contents.split('\n').filter((l) => l.trim());
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 8) {
      continue;
    }
    const filepath = cols[0];
    const state = cols[6];
    if (state === '1' && filepath) {
      result.set(i - 1, filepath);
    }
  }
  return result;
}

export function indexCsvPath(queryCsvPath: string, outputDir: string): string {
  return path.join(
    outputDir,
    path.basename(queryCsvPath, path.extname(queryCsvPath)),
    '_index.csv',
  );
}

export async function readIndexCsvDownloads(
  queryCsvPath: string,
  outputDir: string,
): Promise<Map<number, string>> {
  try {
    const contents = await fs.readFile(indexCsvPath(queryCsvPath, outputDir), 'utf-8');
    return parseIndexCsvDownloads(contents);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Map();
    }
    throw error;
  }
}
