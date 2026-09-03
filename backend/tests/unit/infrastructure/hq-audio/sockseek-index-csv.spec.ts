import {
  indexCsvPath,
  parseCsvLine,
  parseIndexCsvDownloads,
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

describe('indexCsvPath', () => {
  it('derives <outputDir>/<queryCsvBasename>/_index.csv', () => {
    expect(
      indexCsvPath('/tmp/sockseek-batch-query-abc123.csv', '/Users/me/Music/Soulseek'),
    ).toBe('/Users/me/Music/Soulseek/sockseek-batch-query-abc123/_index.csv');
  });
});
