import { EventEmitter } from 'events';
import type { ConfigService } from '@nestjs/config';
import { QobuzAcquirer } from 'src/infrastructure/hq-audio/qobuz.acquirer';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';

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
  const proc = new EventEmitter() as EventEmitter & {
    stderr: EventEmitter;
    kill: () => void;
  };
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  setImmediate(() => proc.emit('close', exitCode));
  return proc;
}

const dirent = (name: string) => ({ name, isDirectory: () => false });

function build(overrides: Partial<Record<string, unknown>> = {}) {
  const qobuz = {
    enabled: true,
    ripConfigPath: '/cfg/rip.toml',
    ripBinaryPath: 'rip',
    outputDir: '/out/qobuz',
    ...overrides,
  };
  const config = {
    get: vi.fn((key: string) =>
      key === 'hqAudio' ? { qobuz, qualityTier: 'lossless' } : undefined,
    ),
  } as unknown as ConfigService;
  return new QobuzAcquirer(config, loggerFactory, noopLogger);
}

describe('QobuzAcquirer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readdirMock.mockResolvedValue([]);
  });

  it('returns null when disabled', async () => {
    const acq = build({ enabled: false });
    expect(await acq.acquire('A', 'T', 100, '')).toBeNull();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('returns null when the rip config path is unset', async () => {
    const acq = build({ ripConfigPath: '' });
    expect(await acq.acquire('A', 'T', 100, '')).toBeNull();
  });

  it('returns the newly downloaded file on success', async () => {
    spawnMock.mockReturnValue(fakeProcess(0));
    readdirMock
      .mockResolvedValueOnce([]) // scan before
      .mockResolvedValueOnce([dirent('A - T.flac')]); // scan after

    const acq = build();
    const result = await acq.acquire('A', 'T', 100, '');

    expect(result).toEqual({ filePath: '/out/qobuz/A - T.flac', format: 'flac' });
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toContain('--config-path');
    expect(args).toContain('qobuz');
    expect(args).toContain('--first');
  });

  it('returns null when rip exits non-zero', async () => {
    spawnMock.mockReturnValue(fakeProcess(1));
    const acq = build();
    expect(await acq.acquire('A', 'T', 100, '')).toBeNull();
  });

  it('returns null when no new file appears', async () => {
    spawnMock.mockReturnValue(fakeProcess(0));
    const acq = build();
    expect(await acq.acquire('A', 'T', 100, '')).toBeNull();
  });
});
