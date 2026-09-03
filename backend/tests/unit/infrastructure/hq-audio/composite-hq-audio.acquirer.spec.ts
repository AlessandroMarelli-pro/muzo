import type { ConfigService } from '@nestjs/config';
import { CompositeHqAudioAcquirer } from 'src/infrastructure/hq-audio/composite-hq-audio.acquirer';
import type { HqAudioAcquireResult } from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import type { SockseekAcquirer } from 'src/infrastructure/hq-audio/sockseek.acquirer';
import type { TidalDlAcquirer } from 'src/infrastructure/hq-audio/tidal-dl.acquirer';

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;

const loggerFactory = { createLogger: () => noopLogger };

function build(order: string[] | undefined) {
  const tidal = { acquire: vi.fn() };
  const sockseek = { acquire: vi.fn() };
  const config = {
    get: vi.fn().mockReturnValue(order),
  } as unknown as ConfigService;

  const acquirer = new CompositeHqAudioAcquirer(
    tidal as unknown as TidalDlAcquirer,
    sockseek as unknown as SockseekAcquirer,
    config,
    loggerFactory,
    noopLogger,
  );
  return { acquirer, tidal, sockseek };
}

const flac = (filePath: string): HqAudioAcquireResult => ({ filePath, format: 'flac' });

describe('CompositeHqAudioAcquirer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tries sources in the configured order and stamps the winning source', async () => {
    const { acquirer, tidal, sockseek } = build(['tidal', 'soulseek']);
    tidal.acquire.mockResolvedValue(flac('/tidal/a.flac'));

    const result = await acquirer.acquire('A', 'B', 100, '');

    expect(result).toEqual({ filePath: '/tidal/a.flac', format: 'flac', source: 'tidal' });
    expect(sockseek.acquire).not.toHaveBeenCalled();
  });

  it('respects a reversed order', async () => {
    const { acquirer, tidal, sockseek } = build(['soulseek', 'tidal']);
    sockseek.acquire.mockResolvedValue(flac('/ss/a.flac'));

    const result = await acquirer.acquire('A', 'B', 100, '');

    expect(result?.source).toBe('soulseek');
    expect(tidal.acquire).not.toHaveBeenCalled();
  });

  it('falls through to the next source on null', async () => {
    const { acquirer, tidal, sockseek } = build(['tidal', 'soulseek']);
    tidal.acquire.mockResolvedValue(null);
    sockseek.acquire.mockResolvedValue(flac('/ss/a.flac'));

    const result = await acquirer.acquire('A', 'B', 100, '');

    expect(result?.source).toBe('soulseek');
  });

  it('falls through to the next source when one throws', async () => {
    const { acquirer, tidal, sockseek } = build(['tidal', 'soulseek']);
    tidal.acquire.mockRejectedValue(new Error('boom'));
    sockseek.acquire.mockResolvedValue(flac('/ss/a.flac'));

    const result = await acquirer.acquire('A', 'B', 100, '');

    expect(result?.source).toBe('soulseek');
  });

  it('skips sources named in the order but not registered', async () => {
    const { acquirer, tidal, sockseek } = build(['qobuz', 'tidal', 'soulseek']);
    tidal.acquire.mockResolvedValue(flac('/tidal/a.flac'));

    const result = await acquirer.acquire('A', 'B', 100, '');

    expect(result?.source).toBe('tidal');
    expect(sockseek.acquire).not.toHaveBeenCalled();
  });

  it('returns null when every source misses', async () => {
    const { acquirer, tidal, sockseek } = build(['tidal', 'soulseek']);
    tidal.acquire.mockResolvedValue(null);
    sockseek.acquire.mockResolvedValue(null);

    expect(await acquirer.acquire('A', 'B', 100, '')).toBeNull();
  });

  it('returns null when no known sources are in the order', async () => {
    const { acquirer, tidal, sockseek } = build(['qobuz']);

    expect(await acquirer.acquire('A', 'B', 100, '')).toBeNull();
    expect(tidal.acquire).not.toHaveBeenCalled();
    expect(sockseek.acquire).not.toHaveBeenCalled();
  });
});
