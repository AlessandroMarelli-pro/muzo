import type { ConfigService } from '@nestjs/config';
import { CompositeHqAudioAcquirer } from 'src/infrastructure/hq-audio/composite-hq-audio.acquirer';
import type { HqAudioAcquireResult } from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import type { SockseekAcquirer } from 'src/infrastructure/hq-audio/sockseek.acquirer';
import type { TidalDlAcquirer } from 'src/infrastructure/hq-audio/tidal-dl.acquirer';

const { probeMock } = vi.hoisted(() => ({ probeMock: vi.fn() }));
vi.mock('src/infrastructure/hq-audio/audio-probe', () => ({
  probeAudioCodec: probeMock,
}));

// Default: every probed file is genuine FLAC. Individual tests override.
const losslessProbe = { codec: 'flac', sampleRate: 44100, lossless: true };
const lossyProbe = { codec: 'aac', sampleRate: 44100, lossless: false };

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;

const loggerFactory = { createLogger: () => noopLogger };

function build(
  order: string[] | undefined,
  opts: {
    verifyLossless?: boolean;
    qualityTier?: string;
    verifier?: { verify: ReturnType<typeof vi.fn> };
  } = {},
) {
  const tidal = { acquire: vi.fn() };
  const qobuz = { acquire: vi.fn() };
  const deezer = { acquire: vi.fn() };
  const sockseek = { acquire: vi.fn() };
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'hqAudio.verifyLossless') return opts.verifyLossless ?? false;
      if (key === 'hqAudio.qualityTier') return opts.qualityTier ?? 'lossless';
      return order;
    }),
  } as unknown as ConfigService;

  const acquirer = new CompositeHqAudioAcquirer(
    tidal as unknown as TidalDlAcquirer,
    qobuz as never,
    deezer as never,
    sockseek as unknown as SockseekAcquirer,
    config,
    loggerFactory,
    noopLogger,
    opts.verifier as never,
  );
  return { acquirer, tidal, qobuz, deezer, sockseek };
}

const flac = (filePath: string): HqAudioAcquireResult => ({ filePath, format: 'flac' });

describe('CompositeHqAudioAcquirer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    probeMock.mockResolvedValue(losslessProbe);
  });

  it('tries sources in the configured order and stamps the winning source', async () => {
    const { acquirer, tidal, sockseek } = build(['tidal', 'soulseek']);
    tidal.acquire.mockResolvedValue(flac('/tidal/a.flac'));

    const result = await acquirer.acquire('A', 'B', 100, '');

    expect(result).toMatchObject({ filePath: '/tidal/a.flac', format: 'flac', source: 'tidal' });
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
    const { acquirer, tidal, sockseek } = build(['bandcamp', 'tidal', 'soulseek']);
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
    const { acquirer, tidal, sockseek } = build(['bandcamp']);

    expect(await acquirer.acquire('A', 'B', 100, '')).toBeNull();
    expect(tidal.acquire).not.toHaveBeenCalled();
    expect(sockseek.acquire).not.toHaveBeenCalled();
  });

  it('drops soulseek to last on the hires quality tier', async () => {
    const { acquirer, qobuz, sockseek } = build(['soulseek', 'qobuz'], {
      qualityTier: 'hires',
    });
    (qobuz.acquire as ReturnType<typeof vi.fn>).mockResolvedValue(flac('/q/a.flac'));

    const result = await acquirer.acquire('A', 'B', 100, '');

    expect(result?.source).toBe('qobuz');
    expect(sockseek.acquire).not.toHaveBeenCalled();
  });

  describe('codec guard', () => {
    it('skips a lossy-codec file and prefers a lossless source after it', async () => {
      probeMock.mockImplementation(async (p: string) =>
        p.startsWith('/tidal') ? lossyProbe : losslessProbe,
      );
      const { acquirer, tidal, sockseek } = build(['tidal', 'soulseek']);
      tidal.acquire.mockResolvedValue(flac('/tidal/aac.m4a'));
      sockseek.acquire.mockResolvedValue(flac('/ss/real.flac'));

      const result = await acquirer.acquire('A', 'B', 100, '');

      expect(result).toMatchObject({ filePath: '/ss/real.flac', source: 'soulseek', verified: true });
    });

    it('returns the lossy file (verified:false) when no lossless source has it', async () => {
      probeMock.mockResolvedValue(lossyProbe);
      const { acquirer, tidal, sockseek } = build(['tidal', 'soulseek']);
      tidal.acquire.mockResolvedValue({ filePath: '/tidal/aac.m4a', format: 'm4a' });
      sockseek.acquire.mockResolvedValue(null);

      const result = await acquirer.acquire('A', 'B', 100, '');

      expect(result).toMatchObject({
        filePath: '/tidal/aac.m4a',
        source: 'tidal',
        verified: false,
      });
    });
  });

  describe('spectral verification', () => {
    it('accepts and stamps a file that passes verification', async () => {
      const verify = vi.fn().mockResolvedValue({ verified: true, cutoffHz: 21500, reason: 'ok' });
      const { acquirer, tidal } = build(['tidal', 'soulseek'], {
        verifyLossless: true,
        verifier: { verify },
      });
      tidal.acquire.mockResolvedValue(flac('/tidal/a.flac'));

      const result = await acquirer.acquire('A', 'B', 100, '');

      expect(verify).toHaveBeenCalledWith('/tidal/a.flac');
      expect(result).toMatchObject({ verified: true, spectralCutoffHz: 21500, source: 'tidal' });
    });

    it('discards a flagged file and falls through to the next source', async () => {
      const verify = vi
        .fn()
        .mockResolvedValueOnce({ verified: false, cutoffHz: 16000, reason: 'transcoded' })
        .mockResolvedValueOnce({ verified: true, cutoffHz: 22000, reason: 'ok' });
      const { acquirer, tidal, sockseek } = build(['tidal', 'soulseek'], {
        verifyLossless: true,
        verifier: { verify },
      });
      tidal.acquire.mockResolvedValue(flac('/tidal/fake.flac'));
      sockseek.acquire.mockResolvedValue(flac('/ss/real.flac'));

      const result = await acquirer.acquire('A', 'B', 100, '');

      expect(result).toMatchObject({ filePath: '/ss/real.flac', verified: true, source: 'soulseek' });
    });

    it('returns null when every source fails verification', async () => {
      const verify = vi.fn().mockResolvedValue({ verified: false, cutoffHz: 15000, reason: 'bad' });
      const { acquirer, tidal, sockseek } = build(['tidal', 'soulseek'], {
        verifyLossless: true,
        verifier: { verify },
      });
      tidal.acquire.mockResolvedValue(flac('/tidal/fake1.flac'));
      sockseek.acquire.mockResolvedValue(flac('/ss/fake2.flac'));

      expect(await acquirer.acquire('A', 'B', 100, '')).toBeNull();
    });

    it('accepts the file unverified when the verifier errors', async () => {
      const verify = vi.fn().mockRejectedValue(new Error('ai-service down'));
      const { acquirer, tidal } = build(['tidal', 'soulseek'], {
        verifyLossless: true,
        verifier: { verify },
      });
      tidal.acquire.mockResolvedValue(flac('/tidal/a.flac'));

      const result = await acquirer.acquire('A', 'B', 100, '');

      expect(result).toMatchObject({ filePath: '/tidal/a.flac', verified: false, source: 'tidal' });
    });
  });
});
