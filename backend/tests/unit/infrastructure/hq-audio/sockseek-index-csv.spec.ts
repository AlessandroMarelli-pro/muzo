import { mkdtempSync, mkdirSync, writeFileSync, existsSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  batchDir,
  indexCsvPath,
  inputCsvPath,
  parseCsvLine,
  parseIndexCsvDownloads,
  parseIndexCsvRows,
  pruneStaleQueryDirs,
  readAllPriorIndexCsvDownloads,
  readIndexCsvRowsAt,
  removeBatchDir,
  trackIdFromPath,
  trackIdToFileToken,
} from 'src/infrastructure/hq-audio/sockseek-index-csv';

/**
 * Real `MusicTrackId`s: the domain id is `MusicTrack:<uuid>`, NOT a bare uuid
 * (see `kernel/ids/factory.ts`). The `UUID_*` constants are the filename-safe
 * token — the same id with the unsafe `:` prefix stripped.
 */
const UUID_A = '11111111-2222-4333-8444-555555555555';
const UUID_B = '66666666-7777-4888-8999-aaaaaaaaaaaa';
const ID_A = `MusicTrack:${UUID_A}`;
const ID_B = `MusicTrack:${UUID_B}`;

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

describe('trackIdToFileToken / trackIdFromPath', () => {
  it('strips the unsafe ":" prefix for the filename', () => {
    // A ":" is illegal in a Windows filename and historically a path separator
    // on macOS, so it must not reach the name-format.
    expect(trackIdToFileToken(ID_A)).toBe(UUID_A);
    expect(trackIdToFileToken(ID_A)).not.toContain(':');
  });

  it('round-trips an id through the filename', () => {
    const name = `/m/Soulseek/b/${trackIdToFileToken(ID_A)}__Daso - Meine.flac`;
    expect(trackIdFromPath(name)).toBe(ID_A);
  });

  it('returns the full MusicTrack:<uuid> id, not the bare uuid', () => {
    const id = trackIdFromPath(`/m/${UUID_A}__x.flac`);
    expect(id).toBe(`MusicTrack:${UUID_A}`);
    expect(id).not.toBe(UUID_A);
  });

  /**
   * Regression: the first cut wrote the raw `MusicTrack:<uuid>` id into the
   * filename and then matched on a bare-uuid regex, so every real download came
   * back `null` and no track was ever persisted. Files written that way still
   * exist on disk, so they must keep resolving.
   */
  it('still reads a legacy filename that kept the MusicTrack: prefix', () => {
    expect(
      trackIdFromPath(
        `/m/Soulseek/b/MusicTrack:${UUID_A}__mad diva - spotlight (dj don & svenson remix).flac`,
      ),
    ).toBe(ID_A);
  });

  it('is null when the filename carries no id', () => {
    expect(trackIdFromPath('/m/Soulseek/01 - Almost Grown.flac')).toBeNull();
  });

  it('does not mistake a leading number for an id', () => {
    expect(trackIdFromPath('/m/Soulseek/2__Almost Grown.flac')).toBeNull();
  });
});

describe('parseIndexCsvDownloads', () => {
  const HEADER = 'filepath,artist,album,title,length,tracktype,state,failurereason';

  it('returns downloaded rows keyed by the id in the filename', () => {
    const csv = [
      HEADER,
      ',freaky realistic,,something new,451,0,2,3', // failed
      `/m/${UUID_A}__EBTG - Missing.flac,everything but the girl,,missing,250,0,1,0`,
      ',the trip,,vibration,373,0,0,0', // pending
      `/m/${UUID_B}__Daso - Meine.flac,daso,,meine,300,0,1,0`,
    ].join('\n');

    expect([...parseIndexCsvDownloads(csv).entries()]).toEqual([
      [ID_A, `/m/${UUID_A}__EBTG - Missing.flac`],
      [ID_B, `/m/${UUID_B}__Daso - Meine.flac`],
    ]);
  });

  /**
   * The regression this whole identity scheme exists for. sockseek dedupes
   * index entries by artist/album/title/length, so two tracks with identical
   * metadata collapse into ONE row — the old positional mapping then attributed
   * that row's file to whichever track happened to sit at that index.
   */
  it('attributes a collapsed duplicate row to the track that actually owns the file', () => {
    const csv = [
      HEADER,
      ',zzz nope,,nothing,0,0,2,3', // input row 0 — failed
      // Input rows 1 and 2 were byte-identical; sockseek wrote only one row for
      // them, at index 1. Positionally that reads as "row 1" — the WRONG track.
      `/m/${UUID_B}__Dup Row - Dup Row.flac,dup row,,dup row,0,0,1,0`,
    ].join('\n');

    const map = parseIndexCsvDownloads(csv);
    expect(map.get(ID_B)).toBe(`/m/${UUID_B}__Dup Row - Dup Row.flac`);
    expect(map.has(ID_A)).toBe(false);
  });

  it('skips a downloaded row whose filename carries no id', () => {
    const csv = [HEADER, '/m/Untagged.flac,a,,t,1,0,1,0'].join('\n');
    expect(parseIndexCsvDownloads(csv).size).toBe(0);
  });

  it('resolves a relative filepath against the given base dir', () => {
    const csv = [HEADER, `./${UUID_A}__A - T.flac,a,,t,1,0,1,0`].join('\n');
    expect(parseIndexCsvDownloads(csv, '/m/Soulseek/batch').get(ID_A)).toBe(
      `/m/Soulseek/batch/${UUID_A}__A - T.flac`,
    );
  });

  it('handles a quoted filepath with a comma', () => {
    const csv = [
      HEADER,
      `"/m/${UUID_A}__Artist, Feat - Song.flac",artist feat,,song,200,0,1,0`,
    ].join('\n');
    expect(parseIndexCsvDownloads(csv).get(ID_A)).toBe(`/m/${UUID_A}__Artist, Feat - Song.flac`);
  });

  it('is empty for a header-only file', () => {
    expect(parseIndexCsvDownloads(HEADER).size).toBe(0);
  });
});

describe('parseIndexCsvRows', () => {
  const HEADER = 'filepath,artist,album,title,length,tracktype,state,failurereason';

  it('classifies downloaded / failed / pending rows', () => {
    const csv = [
      HEADER,
      ',freaky realistic,,something new,451,0,2,no sources',
      '/m/EBTG - Missing.flac,everything but the girl,,missing,250,0,1,',
      ',the trip,,vibration,373,0,0,',
    ].join('\n');

    expect(parseIndexCsvRows(csv)).toEqual([
      { filepath: '', artist: 'freaky realistic', title: 'something new', state: 'failed', failureReason: 'no sources' },
      { filepath: '/m/EBTG - Missing.flac', artist: 'everything but the girl', title: 'missing', state: 'downloaded', failureReason: '' },
      { filepath: '', artist: 'the trip', title: 'vibration', state: 'pending', failureReason: '' },
    ]);
  });

  // sockseek's JobStateOld: 3 = AlreadyExists (file is on disk — adopt it),
  // 4 = NotFoundLastTime (a prior miss it declined to re-search).
  it('treats state 3 as downloaded and state 4 as failed', () => {
    const csv = [
      HEADER,
      '/m/Existing.flac,a,,t,1,0,3,0',
      ',b,,u,1,0,4,0',
    ].join('\n');
    expect(parseIndexCsvRows(csv).map((r) => r.state)).toEqual(['downloaded', 'failed']);
  });

  it('is empty for a header-only file', () => {
    expect(parseIndexCsvRows(HEADER)).toEqual([]);
  });
});

describe('readIndexCsvRowsAt', () => {
  const HEADER = 'filepath,artist,album,title,length,tracktype,state,failurereason';

  it('resolves sockseek\'s relative ./ paths against the index file\'s own dir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ss-rel-'));
    const csv = join(dir, '_index.csv');
    writeFileSync(csv, [HEADER, `./${UUID_A}__A - T.flac,a,,t,1,0,1,`].join('\n'));

    const rows = await readIndexCsvRowsAt(csv);
    expect(rows[0].filepath).toBe(join(dir, `${UUID_A}__A - T.flac`));
  });

  it('is empty for a missing file', async () => {
    expect(await readIndexCsvRowsAt('/no/such/_index.csv')).toEqual([]);
  });
});

describe('batchDir / indexCsvPath / inputCsvPath', () => {
  it('places the manifest and index inside the batch dir', () => {
    expect(batchDir('abc123', '/m/Soulseek')).toBe('/m/Soulseek/sockseek-batch-abc123');
    expect(indexCsvPath('abc123', '/m/Soulseek')).toBe(
      '/m/Soulseek/sockseek-batch-abc123/_index.csv',
    );
    expect(inputCsvPath('abc123', '/m/Soulseek')).toBe(
      '/m/Soulseek/sockseek-batch-abc123/_input.csv',
    );
  });

  it('keeps a path-traversing batch id inside the output dir', () => {
    // Separators are stripped and the `sockseek-batch-` prefix means the
    // remainder can never resolve upward, so the dir stays contained.
    const dir = batchDir('../../etc', '/m/Soulseek');
    expect(dir).toBe('/m/Soulseek/sockseek-batch-.._.._etc');
    expect(dir.startsWith('/m/Soulseek/')).toBe(true);
  });
});

describe('removeBatchDir', () => {
  it('removes the run dir and is a no-op when absent', async () => {
    const out = mkdtempSync(join(tmpdir(), 'ss-out-'));
    const dir = join(out, 'sockseek-batch-X');
    mkdirSync(dir);
    writeFileSync(join(dir, '_index.csv'), 'h\n');

    await removeBatchDir('X', out);
    expect(existsSync(dir)).toBe(false);
    await expect(removeBatchDir('X', out)).resolves.toBeUndefined();
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

  it('collects downloaded rows across every prior batch dir, keyed by track id', async () => {
    const out = mkdtempSync(join(tmpdir(), 'ss-prior-'));
    const dirA = join(out, 'sockseek-batch-aaa');
    const dirB = join(out, 'sockseek-batch-bbb');
    mkdirSync(dirA);
    mkdirSync(dirB);
    writeFileSync(
      join(dirA, '_index.csv'),
      [
        HEADER,
        `/m/${UUID_A}__EBTG - Missing.flac,Everything But The Girl,,Missing,250,0,1,`,
        ',The Trip,,Vibration,373,0,0,',
      ].join('\n'),
    );
    writeFileSync(
      join(dirB, '_index.csv'),
      [HEADER, `/m/${UUID_B}__Daso - Meine.flac,Daso,,Meine,300,0,1,`].join('\n'),
    );

    const map = await readAllPriorIndexCsvDownloads(out);
    expect(map.get(ID_A)).toBe(`/m/${UUID_A}__EBTG - Missing.flac`);
    expect(map.get(ID_B)).toBe(`/m/${UUID_B}__Daso - Meine.flac`);
    expect(map.size).toBe(2); // the pending row contributes nothing
  });

  it('newer batch dir wins on a key collision', async () => {
    const out = mkdtempSync(join(tmpdir(), 'ss-prior-'));
    const older = join(out, 'sockseek-batch-old');
    const newer = join(out, 'sockseek-batch-new');
    mkdirSync(older);
    mkdirSync(newer);
    writeFileSync(
      join(older, '_index.csv'),
      [HEADER, `/m/old/${UUID_A}__A - T.flac,A,,T,1,0,1,`].join('\n'),
    );
    writeFileSync(
      join(newer, '_index.csv'),
      [HEADER, `/m/new/${UUID_A}__A - T.flac,A,,T,1,0,1,`].join('\n'),
    );
    const past = Date.now() / 1000 - 3600;
    utimesSync(older, past, past);

    expect((await readAllPriorIndexCsvDownloads(out)).get(ID_A)).toBe(`/m/new/${UUID_A}__A - T.flac`);
  });

  it('ignores files with no id rather than guessing which track they belong to', async () => {
    const out = mkdtempSync(join(tmpdir(), 'ss-prior-'));
    const dir = join(out, 'sockseek-batch-legacy');
    mkdirSync(dir);
    writeFileSync(
      join(dir, '_index.csv'),
      [HEADER, '/m/01 - Almost Grown.flac,Almost Grown,,Almost Grown,0,0,1,'].join('\n'),
    );
    expect((await readAllPriorIndexCsvDownloads(out)).size).toBe(0);
  });

  it('is empty for a missing output dir', async () => {
    expect((await readAllPriorIndexCsvDownloads('/no/such/dir')).size).toBe(0);
  });
});
