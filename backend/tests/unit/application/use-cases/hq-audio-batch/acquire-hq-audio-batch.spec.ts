import { AcquireHqAudioBatchUseCase } from 'src/application/use-cases/hq-audio-batch/AcquireHqAudioBatch';
import type { IHqAudioBatchProgressPublisher } from 'src/application/ports/infrastructure/IHqAudioBatchProgressPublisher';
import type { IHqAudioTagger } from 'src/application/ports/infrastructure/IHqAudioTagger';
import type { IHqAudioVerifier } from 'src/application/ports/infrastructure/IHqAudioVerifier';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import type { IMusicTrackRepository } from 'src/application/ports/repositories/IMusicTrackRepository';
import type { HqAudioBatchId, MusicTrackId } from 'src/kernel/ids';

const { probeMock } = vi.hoisted(() => ({ probeMock: vi.fn() }));
vi.mock('src/infrastructure/hq-audio/audio-probe', () => ({ probeAudioCodec: probeMock }));

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;
const loggerFactory = { createLogger: () => noopLogger };

const BATCH = 'batch-1' as HqAudioBatchId;
const T1 = 't1' as MusicTrackId;
const T2 = 't2' as MusicTrackId;

function track(id: MusicTrackId) {
  return {
    id,
    artist: 'A',
    title: id,
    technicalInfo: { duration: 100 },
    metadata: {},
  };
}

function makeUseCase(over: {
  tidalMatch?: unknown;
  tidalDownload?: unknown;
  updateOneById?: ReturnType<typeof vi.fn>;
  acquireBatch?: ReturnType<typeof vi.fn>;
}) {
  const repo = {
    getManyByIds: vi.fn().mockResolvedValue([track(T1), track(T2)]),
    updateOneById: over.updateOneById ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as IMusicTrackRepository;

  const tidal = {
    findMatch: vi
      .fn()
      .mockResolvedValue(
        over.tidalMatch === undefined
          ? { trackId: 'x', queryArtist: 'A', queryTitle: 'T' }
          : over.tidalMatch,
      ),
    downloadMatch: vi
      .fn()
      .mockResolvedValue(
        over.tidalDownload === undefined
          ? { filePath: '/tidal/f.flac', format: 'flac' }
          : over.tidalDownload,
      ),
  };

  const sockseek = {
    acquireBatch: over.acquireBatch ?? vi.fn().mockResolvedValue(undefined),
  };

  const publisher = {
    updateTrackStatus: vi.fn().mockResolvedValue({ status: 'running', tracks: [], updatedAt: '' }),
    publishEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as IHqAudioBatchProgressPublisher;

  const verifier = {
    verify: vi.fn().mockResolvedValue({ verified: true, cutoffHz: 21000, reason: 'ok' }),
  } as unknown as IHqAudioVerifier;

  const tagger = { tagInPlace: vi.fn().mockResolvedValue(undefined) } as unknown as IHqAudioTagger;

  const config = { get: vi.fn().mockReturnValue(true) } as never;

  const uc = new AcquireHqAudioBatchUseCase(
    repo,
    tidal as never,
    sockseek as never,
    publisher,
    verifier,
    tagger,
    config,
    loggerFactory,
    noopLogger,
  );
  return { uc, repo, tidal, sockseek, publisher, tagger };
}

describe('AcquireHqAudioBatchUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    probeMock.mockResolvedValue({ codec: 'flac', sampleRate: 44100, lossless: true });
  });

  it('persists a lossless Tidal result with hqAudioSource=tidal', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const { uc } = makeUseCase({ updateOneById: update });

    await uc.execute(BATCH, [T1, T2]);

    expect(update).toHaveBeenCalledWith(
      T1,
      expect.objectContaining({ hqAudioPath: '/tidal/f.flac', hqAudioSource: 'tidal' }),
    );
  });

  it("does not abort the batch when one track's DB write throws", async () => {
    const update = vi
      .fn()
      .mockRejectedValueOnce(new Error('P2025'))
      .mockResolvedValue(undefined);
    const { uc, publisher } = makeUseCase({ updateOneById: update });

    await uc.execute(BATCH, [T1, T2]);

    // both tracks attempted
    expect(update).toHaveBeenCalledTimes(2);
    // the failing one is marked failed
    expect(publisher.updateTrackStatus).toHaveBeenCalledWith(
      BATCH,
      T1,
      'failed',
      expect.stringContaining('Persist failed'),
    );
  });

  it('sends a lossy Tidal file to Soulseek, then keeps it if Soulseek misses', async () => {
    probeMock.mockResolvedValue({ codec: 'aac', sampleRate: 44100, lossless: false });
    const update = vi.fn().mockResolvedValue(undefined);
    // Soulseek reports not-found for every track
    const acquireBatch = vi.fn(async (_b, _q, _o, _c, cbs) => {
      cbs.onTrackSettled(T1, { status: 'not-found' });
      cbs.onTrackSettled(T2, { status: 'not-found' });
    });
    const { uc } = makeUseCase({
      updateOneById: update,
      acquireBatch,
      tidalDownload: { filePath: '/tidal/f.m4a', format: 'm4a' },
    });

    await uc.execute(BATCH, [T1, T2]);

    expect(update).toHaveBeenCalledWith(
      T1,
      expect.objectContaining({
        hqAudioPath: '/tidal/f.m4a',
        hqAudioSource: 'tidal',
        hqAudioVerified: false,
      }),
    );
  });
});
