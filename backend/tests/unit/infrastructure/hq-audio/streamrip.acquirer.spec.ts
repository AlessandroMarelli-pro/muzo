import { EventEmitter } from 'events';
import type { ConfigService } from '@nestjs/config';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { DeezerAcquirer } from 'src/infrastructure/hq-audio/deezer.acquirer';
import { QobuzAcquirer } from 'src/infrastructure/hq-audio/qobuz.acquirer';

const { spawnMock, readdirMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  readdirMock: vi.fn(),
}));
vi.mock('child_process', () => ({ spawn: spawnMock }));
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: readdirMock,
}));

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;
const loggerFactory = { createLogger: () => noopLogger };

function fakeProcess(exitCode: number) {
  const proc = new EventEmitter() as EventEmitter & { stderr: EventEmitter; kill: () => void };
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  setImmediate(() => proc.emit('close', exitCode));
  return proc;
}
const dirent = (name: string) => ({ name, isDirectory: () => false });

function configFor(source: 'qobuz' | 'deezer', overrides: Record<string, unknown> = {}) {
  const cfg = {
    enabled: true,
    ripConfigPath: '/cfg/rip.toml',
    ripBinaryPath: 'rip',
    outputDir: `/out/${source}`,
    ...overrides,
  };
  return {
    get: vi.fn((key: string) =>
      key === 'hqAudio' ? { [source]: cfg, qualityTier: 'lossless' } : undefined,
    ),
  } as unknown as ConfigService;
}

describe.each([
  ['qobuz', (c: ConfigService) => new QobuzAcquirer(c, loggerFactory)] as const,
  ['deezer', (c: ConfigService) => new DeezerAcquirer(c, loggerFactory)] as const,
])('%s acquirer (streamrip)', (source, make) => {
  beforeEach(() => {
    vi.clearAllMocks();
    readdirMock.mockResolvedValue([]);
  });

  it('returns null when disabled', async () => {
    const acq = make(configFor(source as 'qobuz' | 'deezer', { enabled: false }));
    expect(await acq.acquire('A', 'T', 100, '')).toBeNull();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('returns null when the rip config path is unset', async () => {
    const acq = make(configFor(source as 'qobuz' | 'deezer', { ripConfigPath: '' }));
    expect(await acq.acquire('A', 'T', 100, '')).toBeNull();
  });

  it('returns the newly downloaded file on success and passes the source to rip', async () => {
    spawnMock.mockReturnValue(fakeProcess(0));
    readdirMock.mockResolvedValueOnce([]).mockResolvedValueOnce([dirent('A - T.flac')]);

    const acq = make(configFor(source as 'qobuz' | 'deezer'));
    const result = await acq.acquire('A', 'T', 100, '');

    expect(result).toEqual({ filePath: `/out/${source}/A - T.flac`, format: 'flac' });
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toContain('--config-path');
    expect(args).toContain('--first');
    expect(args).toContain(source);
  });

  it('returns null when rip exits non-zero', async () => {
    spawnMock.mockReturnValue(fakeProcess(1));
    expect(await make(configFor(source as 'qobuz' | 'deezer')).acquire('A', 'T', 100, '')).toBeNull();
  });

  it('returns null when no new file appears', async () => {
    spawnMock.mockReturnValue(fakeProcess(0));
    expect(await make(configFor(source as 'qobuz' | 'deezer')).acquire('A', 'T', 100, '')).toBeNull();
  });
});
