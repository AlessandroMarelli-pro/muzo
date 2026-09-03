import { AcquireHqAudioBatchUseCase } from 'src/application/use-cases/hq-audio-batch/AcquireHqAudioBatch';
import type { IHqAudioBatchProgressPublisher } from 'src/application/ports/infrastructure/IHqAudioBatchProgressPublisher';
import type { IHqAudioTagger } from 'src/application/ports/infrastructure/IHqAudioTagger';
import type { IHqAudioVerifier } from 'src/application/ports/infrastructure/IHqAudioVerifier';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import type { IMusicTrackRepository } from 'src/application/ports/repositories/IMusicTrackRepository';
import type { HqAudioBatchId, MusicTrackId } from 'src/kernel/ids';

vi.mock('fs/promises', () => ({ access: vi.fn().mockResolvedValue(undefined) }));

const { readRowsMock } = vi.hoisted(() => ({ readRowsMock: vi.fn() }));
vi.mock('src/infrastructure/hq-audio/sockseek-index-csv', () => ({
  readIndexCsvRowsAt: readRowsMock,
}));

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

const flush = () => new Promise((r) => setTimeout(r, 5));

function track(id: MusicTrackId) {
  return { id, artist: 'A', title: id, technicalInfo: { duration: 100 }, metadata: {} };
}

type SettleOutcome =
  | { status: 'succeeded'; result: { filePath: string; format: string } }
  | { status: 'not-found' }
  | { status: 'interrupted' };

function makeUseCase(over: {
  updateOneById?: ReturnType<typeof vi.fn>;
  /** How Soulseek settles each track (by id). Default: not-found. Pass `null` to
   *  not settle it at all (simulating a dropped stdout event). */
  soulseek?: Partial<Record<MusicTrackId, SettleOutcome | null>>;
  tidalMatch?: unknown;
  tidalDownload?: unknown;
  verify?: ReturnType<typeof vi.fn>;
}) {
  const repo = {
    getManyByIds: vi.fn().mockResolvedValue([track(T1), track(T2)]),
    updateOneById: over.updateOneById ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as IMusicTrackRepository;

  const acquireBatch = vi.fn(async (_b, queries, _o, _c, cbs) => {
    for (const q of queries) {
      const outcome =
        over.soulseek && q.key in over.soulseek
          ? over.soulseek[q.key as MusicTrackId]
          : { status: 'not-found' };
      if (outcome) cbs.onTrackSettled(q.key, outcome);
    }
  });
  const sockseek = {
    acquireBatch,
    batchIndexCsvPath: vi.fn().mockReturnValue('/idx/_index.csv'),
  };

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
          ? { filePath: '/tidal/f.m4a', format: 'm4a' }
          : over.tidalDownload,
      ),
  };

  const publisher = {
    updateTrackStatus: vi.fn().mockResolvedValue({ status: 'running', tracks: [], updatedAt: '' }),
    publishEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as IHqAudioBatchProgressPublisher;

  const verifier = {
    verify: over.verify ?? vi.fn().mockResolvedValue({ verified: true, cutoffHz: 21000, reason: 'ok' }),
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
  return { uc, repo, tidal, sockseek, publisher, tagger, verifier };
}

const succeededCalls = (update: ReturnType<typeof vi.fn>, key: MusicTrackId) =>
  update.mock.calls.filter((c) => c[0] === key);

describe('AcquireHqAudioBatchUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readRowsMock.mockResolvedValue([]);
  });

  it('fast-persists a Soulseek FLAC (hqAudioPath + succeeded) before verifying', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const verify = vi.fn().mockResolvedValue({ verified: true, cutoffHz: 21000, reason: 'ok' });
    const { uc, publisher } = makeUseCase({
      updateOneById: update,
      verify,
      soulseek: {
        [T1]: { status: 'succeeded', result: { filePath: '/ss/1.flac', format: 'flac' } },
        [T2]: { status: 'succeeded', result: { filePath: '/ss/2.flac', format: 'flac' } },
      },
    });

    await uc.execute(BATCH, [T1, T2]);
    await flush();

    // phase A: hqAudioPath+source written, marked succeeded — WITHOUT verified fields
    expect(update).toHaveBeenCalledWith(T1, {
      hqAudioPath: '/ss/1.flac',
      hqAudioSource: 'soulseek',
    });
    expect(publisher.updateTrackStatus).toHaveBeenCalledWith(BATCH, T1, 'succeeded', undefined);
    // phase B: verify ran and wrote the verified fields, after
    expect(verify).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      T1,
      expect.objectContaining({ hqAudioVerified: true, hqAudioSpectralCutoffHz: 21000 }),
    );
  });

  it('recovers a downloaded track the stdout stream dropped, via _index.csv', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    // Soulseek never settles T1 (dropped event); _index.csv shows it downloaded.
    readRowsMock.mockResolvedValue([
      { index: 0, filepath: '/ss/recovered.flac', artist: 'A', title: 't1', state: 'downloaded', failureReason: '' },
    ]);
    const { uc, publisher } = makeUseCase({
      updateOneById: update,
      soulseek: { [T1]: null, [T2]: { status: 'not-found' } },
      tidalMatch: null,
    });

    await uc.execute(BATCH, [T1, T2]);
    await flush();

    expect(update).toHaveBeenCalledWith(T1, {
      hqAudioPath: '/ss/recovered.flac',
      hqAudioSource: 'soulseek',
    });
    expect(publisher.updateTrackStatus).toHaveBeenCalledWith(BATCH, T1, 'succeeded', undefined);
  });

  it('does not double-persist when both the event and _index.csv report a track', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    readRowsMock.mockResolvedValue([
      { index: 0, filepath: '/ss/1.flac', artist: 'A', title: 't1', state: 'downloaded', failureReason: '' },
    ]);
    const { uc } = makeUseCase({
      updateOneById: update,
      soulseek: {
        [T1]: { status: 'succeeded', result: { filePath: '/ss/1.flac', format: 'flac' } },
        [T2]: { status: 'not-found' },
      },
      tidalMatch: null,
    });

    await uc.execute(BATCH, [T1, T2]);
    await flush();

    // exactly one phase-A write for T1 (hqAudioPath+source)
    const phaseA = succeededCalls(update, T1).filter(
      (c) => c[1].hqAudioPath && !('hqAudioVerified' in c[1]),
    );
    expect(phaseA).toHaveLength(1);
  });

  it('falls back to Tidal (lossy) for a Soulseek miss', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const { uc, tidal } = makeUseCase({
      updateOneById: update,
      soulseek: {
        [T1]: { status: 'not-found' },
        [T2]: { status: 'succeeded', result: { filePath: '/ss/2.flac', format: 'flac' } },
      },
    });

    await uc.execute(BATCH, [T1, T2]);
    await flush();

    expect(tidal.findMatch).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(T1, {
      hqAudioPath: '/tidal/f.m4a',
      hqAudioSource: 'tidal',
    });
  });

  it('marks a track failed when both Soulseek and Tidal miss', async () => {
    const { uc, publisher } = makeUseCase({
      soulseek: { [T1]: { status: 'not-found' }, [T2]: { status: 'not-found' } },
      tidalMatch: null,
    });

    await uc.execute(BATCH, [T1, T2]);
    await flush();

    expect(publisher.updateTrackStatus).toHaveBeenCalledWith(
      BATCH,
      T1,
      'failed',
      expect.stringContaining('No match found on any source'),
    );
  });

  it("does not abort the batch when one track's DB write throws", async () => {
    const update = vi.fn().mockRejectedValueOnce(new Error('P2025')).mockResolvedValue(undefined);
    const { uc, publisher } = makeUseCase({
      updateOneById: update,
      soulseek: {
        [T1]: { status: 'succeeded', result: { filePath: '/ss/1.flac', format: 'flac' } },
        [T2]: { status: 'succeeded', result: { filePath: '/ss/2.flac', format: 'flac' } },
      },
    });

    await uc.execute(BATCH, [T1, T2]);
    await flush();

    expect(publisher.updateTrackStatus).toHaveBeenCalledWith(
      BATCH,
      T1,
      'failed',
      expect.stringContaining('Persist failed'),
    );
  });
});
