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

function build(match: { trackId: string | null } = { trackId: 't1' }) {
  const sync = {
    findBestMatch: vi.fn().mockResolvedValue({
      trackId: match.trackId,
      confidence: match.trackId ? 'exact' : 'none',
      matchedTrack: match.trackId
        ? { id: match.trackId, title: 'T', artist: 'A', duration: 100 }
        : undefined,
    }),
  } as unknown as ITidalSyncProvider;
  const config = {
    get: vi.fn((k: string) =>
      k === 'hqAudio.tidal.outputDir' ? '/tidal' : k === 'hqAudio.qualityTier' ? 'lossless' : undefined,
    ),
  } as unknown as ConfigService;
  return new TidalDlAcquirer(sync, config, loggerFactory, noopLogger);
}

// getCurrentUserId reads AsyncLocalStorage; stub the module.
vi.mock('src/kernel/types/context', () => ({ getCurrentUserId: () => 'user-1' }));

describe('TidalDlAcquirer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readdirMock.mockResolvedValue([]);
    spawnMock.mockImplementation(() => fakeProc(0));
  });

  it('findMatch returns null when Tidal has no match', async () => {
    const acq = build({ trackId: null });
    expect(await acq.findMatch('A', 'T', 100)).toBeNull();
  });

  it('downloadMatch reports format flac when the codec probe says flac', async () => {
    readdirMock.mockResolvedValueOnce([]).mockResolvedValueOnce([dirent('A - T.flac')]);
    probeMock.mockResolvedValue({ codec: 'flac', sampleRate: 44100, lossless: true });

    const acq = build();
    const match = await acq.findMatch('A', 'T', 100);
    const result = await acq.downloadMatch(match!, '');

    expect(result).toEqual({ filePath: '/tidal/A - T.flac', format: 'flac' });
  });

  it('downloadMatch reports format m4a for an AAC file (lossy — composite decides)', async () => {
    readdirMock.mockResolvedValueOnce([]).mockResolvedValueOnce([dirent('A - T.m4a')]);
    probeMock.mockResolvedValue({ codec: 'aac', sampleRate: 44100, lossless: false });

    const acq = build();
    const result = await acq.downloadMatch((await acq.findMatch('A', 'T', 100))!, '');

    expect(result).toEqual({ filePath: '/tidal/A - T.m4a', format: 'm4a' });
  });

  it('serialises concurrent downloads (only one dl process at a time)', async () => {
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
    readdirMock.mockResolvedValue([dirent('A - T.flac')]);
    probeMock.mockResolvedValue({ codec: 'flac', sampleRate: 44100, lossless: true });

    const acq = build();
    const m = (await acq.findMatch('A', 'T', 100))!;
    await Promise.all([acq.downloadMatch(m, ''), acq.downloadMatch(m, ''), acq.downloadMatch(m, '')]);

    // cfg (once) + dl calls, but never two dl in parallel.
    expect(peak).toBe(1);
  });
});
