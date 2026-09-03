import { EventEmitter } from 'events';
import type { ConfigService } from '@nestjs/config';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import type { ITidalSyncProvider } from 'src/application/ports/infrastructure/ITidalSyncProvider';
import { TidalDlAcquirer } from 'src/infrastructure/hq-audio/tidal-dl.acquirer';

const { spawnMock, readdirMock, probeMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  readdirMock: vi.fn(),
  probeMock: vi.fn(),
}));
vi.mock('child_process', () => ({ spawn: spawnMock }));
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: readdirMock,
}));
vi.mock('src/infrastructure/hq-audio/audio-probe', () => ({ probeAudioCodec: probeMock }));
vi.mock('src/kernel/types/context', () => ({ getCurrentUserId: () => 'user-1' }));

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;
const loggerFactory = { createLogger: () => noopLogger };

function fakeProc(code = 0) {
  const p = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
  p.stderr = new EventEmitter();
  setImmediate(() => p.emit('close', code));
  return p;
}
const dirent = (name: string) => ({ name, isDirectory: () => false });

/** readdir returns `files` on every call (flat dir, no recursion). */
function dirHas(...names: string[]) {
  readdirMock.mockResolvedValue(names.map(dirent));
}

function build(
  match: { trackId: string | null; matchedArtist?: string; matchedTitle?: string } = {
    trackId: 't1',
  },
) {
  const sync = {
    findBestMatch: vi.fn().mockResolvedValue({
      trackId: match.trackId,
      confidence: match.trackId ? 'exact' : 'none',
      matchedTrack: match.trackId
        ? {
            id: match.trackId,
            title: match.matchedTitle ?? 'T',
            artist: match.matchedArtist ?? 'A',
            duration: 100,
          }
        : undefined,
    }),
  } as unknown as ITidalSyncProvider;
  const config = {
    get: vi.fn((k: string) =>
      k === 'hqAudio.tidal.outputDir'
        ? '/tidal'
        : k === 'hqAudio.qualityTier'
          ? 'lossless'
          : undefined,
    ),
  } as unknown as ConfigService;
  return new TidalDlAcquirer(sync, config, loggerFactory, noopLogger);
}

describe('TidalDlAcquirer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readdirMock.mockResolvedValue([]);
    spawnMock.mockImplementation(() => fakeProc(0));
    probeMock.mockResolvedValue({ codec: 'flac', sampleRate: 44100, lossless: true });
  });

  it('findMatch returns null when Tidal has no match', async () => {
    const acq = build({ trackId: null });
    expect(await acq.findMatch('A', 'T', 100)).toBeNull();
  });

  describe('already-on-disk adoption', () => {
    it('adopts an existing file without spawning tidal-dl-ng', async () => {
      dirHas('A - T.flac');
      const acq = build({ trackId: 't1', matchedArtist: 'A', matchedTitle: 'T' });
      const result = await acq.downloadMatch((await acq.findMatch('A', 'T', 100))!, '');

      expect(result).toEqual({ filePath: '/tidal/A - T.flac', format: 'flac' });
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it('adopts using Tidal metadata even when it differs from our query', async () => {
      dirHas('Everything But The Girl, Todd Terry - Missing (Todd Terry Lite Mix).m4a');
      probeMock.mockResolvedValue({ codec: 'aac', sampleRate: 44100, lossless: false });
      const acq = build({
        trackId: 't1',
        matchedArtist: 'Everything But The Girl, Todd Terry',
        matchedTitle: 'Missing (Todd Terry Lite Mix)',
      });
      const result = await acq.downloadMatch(
        (await acq.findMatch('everything but the girl', 'missing (todd terry lite mix)', 250))!,
        '',
      );

      expect(result?.format).toBe('m4a');
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it('does NOT adopt a file that only shares one of artist/title', async () => {
      dirHas('A - Different Song.flac');
      const acq = build({ trackId: 't1', matchedArtist: 'A', matchedTitle: 'T' });
      await acq.downloadMatch((await acq.findMatch('A', 'T', 100))!, '');

      // no adoption → falls through to the download
      expect(spawnMock).toHaveBeenCalled();
    });

    it('does NOT adopt when title appears before artist (wrong track)', async () => {
      dirHas('T - A song by someone else.flac');
      const acq = build({ trackId: 't1', matchedArtist: 'A', matchedTitle: 'T' });
      await acq.downloadMatch((await acq.findMatch('A', 'T', 100))!, '');
      expect(spawnMock).toHaveBeenCalled();
    });
  });

  it('downloads and reports format from the codec probe when nothing is on disk', async () => {
    // empty before, one new .flac after
    readdirMock
      .mockResolvedValueOnce([]) // findExistingDownload
      .mockResolvedValueOnce([]) // filesBefore
      .mockResolvedValueOnce([dirent('A - T.flac')]); // after download
    const acq = build({ trackId: 't1', matchedArtist: 'ZZ', matchedTitle: 'YY' });

    const result = await acq.downloadMatch((await acq.findMatch('A', 'T', 100))!, '');

    expect(result).toEqual({ filePath: '/tidal/A - T.flac', format: 'flac' });
    expect(spawnMock).toHaveBeenCalled();
  });

  it('reports m4a for a downloaded AAC file', async () => {
    readdirMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([dirent('A - T.m4a')]);
    probeMock.mockResolvedValue({ codec: 'aac', sampleRate: 44100, lossless: false });
    const acq = build({ trackId: 't1', matchedArtist: 'ZZ', matchedTitle: 'YY' });

    const result = await acq.downloadMatch((await acq.findMatch('A', 'T', 100))!, '');

    expect(result).toEqual({ filePath: '/tidal/A - T.m4a', format: 'm4a' });
  });

  it('serialises concurrent downloads (only one tidal-dl-ng process at a time)', async () => {
    let running = 0;
    let peak = 0;
    spawnMock.mockImplementation(() => {
      const p = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      p.stderr = new EventEmitter();
      running++;
      peak = Math.max(peak, running);
      setTimeout(() => {
        running--;
        p.emit('close', 0);
      }, 5);
      return p;
    });
    // no file on disk so each call downloads
    readdirMock.mockResolvedValue([]);
    const acq = build({ trackId: 't1', matchedArtist: 'ZZ', matchedTitle: 'YY' });
    const m = (await acq.findMatch('A', 'T', 100))!;
    await Promise.all([acq.downloadMatch(m, ''), acq.downloadMatch(m, ''), acq.downloadMatch(m, '')]);

    expect(peak).toBe(1);
  });
});
