import { mkdtempSync, mkdirSync, writeFileSync, existsSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  indexCsvDir,
  indexCsvPath,
  parseCsvLine,
  parseIndexCsvDownloads,
  parseIndexCsvRows,
  pruneStaleQueryDirs,
  readAllPriorIndexCsvDownloads,
  removeIndexCsvDir,
} from 'src/infrastructure/hq-audio/sockseek-index-csv';

describe('parseCsvLine', () => {
  it('splits plain fields', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });
  it('keeps commas inside quotes', () => {
    expect(parseCsvLine('"x, y",z')).toEqual(['x, y', 'z']);
  });
  it('unescapes doubled quotes', () => {
    expect(parseCsvLine('"a ""b"" c",d')).toEqual(['a "b" c', 'd']);
  });
  it('handles empty leading field (sockseek: empty filepath)', () => {
    expect(parseCsvLine(',artist,,title,373,0,2,3')).toEqual([
      '',
      'artist',
      '',
      'title',
      '373',
      '0',
      '2',
      '3',
    ]);
  });
});

describe('parseIndexCsvDownloads', () => {
  const HEADER = 'filepath,artist,album,title,length,tracktype,state,failurereason';

  it('returns only state==1 rows with a filepath, keyed by 0-based data-row index', () => {
    const csv = [
      HEADER,
      ',freaky realistic,,something new,451,0,2,3', // row 0 - failed
      '/m/EBTG - Missing.flac,everything but the girl,,missing (todd terry lite mix),250,0,1,0', // row 1 - downloaded
      ',the trip,,vibration,373,0,0,0', // row 2 - matched, not finished
      '/m/Daso - Meine.flac,daso,,meine,300,0,1,0', // row 3 - downloaded
    ].join('\n');

    const map = parseIndexCsvDownloads(csv);
    expect([...map.entries()]).toEqual([
      [1, '/m/EBTG - Missing.flac'],
      [3, '/m/Daso - Meine.flac'],
    ]);
  });

  it('handles a quoted filepath with a comma', () => {
    const csv = [
      HEADER,
      '"/m/Artist, Feat - Song.flac",artist feat,,song,200,0,1,0',
    ].join('\n');
    expect(parseIndexCsvDownloads(csv).get(0)).toBe('/m/Artist, Feat - Song.flac');
  });

  it('is empty for a header-only file', () => {
    expect(parseIndexCsvDownloads(HEADER).size).toBe(0);
  });
});

describe('parseIndexCsvRows', () => {
  const HEADER = 'filepath,artist,album,title,length,tracktype,state,failurereason';

  it('classifies downloaded / failed / pending rows with 0-based index', () => {
    const csv = [
      HEADER,
      ',freaky realistic,,something new,451,0,2,no sources', // row 0 - failed
      '/m/EBTG - Missing.flac,everything but the girl,,missing,250,0,1,', // row 1 - downloaded
      ',the trip,,vibration,373,0,0,', // row 2 - pending
    ].join('\n');

    expect(parseIndexCsvRows(csv)).toEqual([
      { index: 0, filepath: '', artist: 'freaky realistic', title: 'something new', state: 'failed', failureReason: 'no sources' },
      { index: 1, filepath: '/m/EBTG - Missing.flac', artist: 'everything but the girl', title: 'missing', state: 'downloaded', failureReason: '' },
      { index: 2, filepath: '', artist: 'the trip', title: 'vibration', state: 'pending', failureReason: '' },
    ]);
  });

  it('is empty for a header-only file', () => {
    expect(parseIndexCsvRows(HEADER)).toEqual([]);
  });
});

describe('indexCsvPath / indexCsvDir', () => {
  it('derives <outputDir>/<queryCsvBasename>/_index.csv', () => {
    expect(indexCsvDir('/tmp/sockseek-batch-abc123.csv', '/m/Soulseek')).toBe(
      '/m/Soulseek/sockseek-batch-abc123',
    );
    expect(indexCsvPath('/tmp/sockseek-batch-abc123.csv', '/m/Soulseek')).toBe(
      '/m/Soulseek/sockseek-batch-abc123/_index.csv',
    );
  });
});

describe('removeIndexCsvDir', () => {
  it('removes the run dir and is a no-op when absent', async () => {
    const out = mkdtempSync(join(tmpdir(), 'ss-out-'));
    const query = join(tmpdir(), 'sockseek-batch-X.csv');
    const dir = join(out, 'sockseek-batch-X');
    mkdirSync(dir);
    writeFileSync(join(dir, '_index.csv'), 'h\n');

    await removeIndexCsvDir(query, out);
    expect(existsSync(dir)).toBe(false);
    await expect(removeIndexCsvDir(query, out)).resolves.toBeUndefined();
  });
});

describe('pruneStaleQueryDirs', () => {
  it('removes only stale sockseek-*query-* / sockseek-batch-* dirs', async () => {
    const out = mkdtempSync(join(tmpdir(), 'ss-prune-'));
    const oldQuery = join(out, 'sockseek-batch-query-old');
    const oldBatch = join(out, 'sockseek-batch-abc123');
    const freshBatch = join(out, 'sockseek-batch-def456');
    const unrelated = join(out, 'Some Album');
    for (const d of [oldQuery, oldBatch, freshBatch, unrelated]) mkdirSync(d);
    const past = Date.now() / 1000 - 3 * 24 * 3600;
    utimesSync(oldQuery, past, past);
    utimesSync(oldBatch, past, past);

    const removed = await pruneStaleQueryDirs(out, 24 * 3600 * 1000);
    expect(removed).toBe(2);
    expect(existsSync(oldQuery)).toBe(false);
    expect(existsSync(oldBatch)).toBe(false);
    expect(existsSync(freshBatch)).toBe(true);
    expect(existsSync(unrelated)).toBe(true);
  });

  it('returns 0 for a missing dir', async () => {
    expect(await pruneStaleQueryDirs('/no/such/dir/xyz', 1000)).toBe(0);
  });
});

describe('readAllPriorIndexCsvDownloads', () => {
  const HEADER = 'filepath,artist,album,title,length,tracktype,state,failurereason';

  it('collects downloaded rows across every prior batch dir, keyed by artist|title', async () => {
    const out = mkdtempSync(join(tmpdir(), 'ss-prior-'));
    const dirA = join(out, 'sockseek-batch-aaa');
    const dirB = join(out, 'sockseek-batch-bbb');
    mkdirSync(dirA);
    mkdirSync(dirB);
    writeFileSync(
      join(dirA, '_index.csv'),
      [HEADER, '/m/EBTG - Missing.flac,Everything But The Girl,,Missing,250,0,1,', ',The Trip,,Vibration,373,0,0,'].join('\n'),
    );
    writeFileSync(
      join(dirB, '_index.csv'),
      [HEADER, '/m/Daso - Meine.flac,Daso,,Meine,300,0,1,'].join('\n'),
    );

    const map = await readAllPriorIndexCsvDownloads(out);
    expect(map.get('everything but the girl|missing')).toBe('/m/EBTG - Missing.flac');
    expect(map.get('daso|meine')).toBe('/m/Daso - Meine.flac');
    expect(map.has('the trip|vibration')).toBe(false); // not downloaded
  });

  it('newer batch dir wins on a key collision', async () => {
    const out = mkdtempSync(join(tmpdir(), 'ss-prior-'));
    const older = join(out, 'sockseek-batch-old');
    const newer = join(out, 'sockseek-batch-new');
    mkdirSync(older);
    mkdirSync(newer);
    writeFileSync(join(older, '_index.csv'), [HEADER, '/m/old.flac,A,,T,1,0,1,'].join('\n'));
    writeFileSync(join(newer, '_index.csv'), [HEADER, '/m/new.flac,A,,T,1,0,1,'].join('\n'));
    const past = Date.now() / 1000 - 3600;
    utimesSync(older, past, past);

    expect((await readAllPriorIndexCsvDownloads(out)).get('a|t')).toBe('/m/new.flac');
  });

  it('is empty for a missing output dir', async () => {
    expect((await readAllPriorIndexCsvDownloads('/no/such/dir')).size).toBe(0);
  });
});
