import type { ICopyAudioWithMetadata } from 'src/application/ports/infrastructure/ICopyAudioWithMetadata';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import type { IImageSearchRepository } from 'src/application/ports/repositories/IImageSearchRepository';
import { HqAudioTaggerAdapter } from 'src/infrastructure/hq-audio/hq-audio-tagger.adapter';
import type { MusicTrack } from 'src/kernel/types/model-types';

const { renameMock, unlinkMock } = vi.hoisted(() => ({
  renameMock: vi.fn(),
  unlinkMock: vi.fn(),
}));
vi.mock('fs/promises', () => ({ rename: renameMock, unlink: unlinkMock }));

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;
const loggerFactory = { createLogger: () => noopLogger };

const track = {
  id: 't1',
  artist: 'A',
  title: 'B',
  metadata: { genres: ['House'], subgenres: ['Deep House'] },
} as unknown as MusicTrack;

function build(opts: { image?: unknown; copyImpl?: () => Promise<void> } = {}) {
  const copy = {
    copyAudioWithMetadata: vi.fn(opts.copyImpl ?? (async () => undefined)),
  } as unknown as ICopyAudioWithMetadata;
  const images = {
    findLatestImageForTrack: vi.fn().mockResolvedValue(opts.image ?? null),
  } as unknown as IImageSearchRepository;
  const adapter = new HqAudioTaggerAdapter(copy, images, loggerFactory, noopLogger);
  return { adapter, copy, images };
}

describe('HqAudioTaggerAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renameMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
  });

  it('tags to a temp file then renames over the original', async () => {
    const { adapter, copy } = build();
    await adapter.tagInPlace('/music/a.flac', track);

    const [inPath, tempPath] = (copy.copyAudioWithMetadata as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(inPath).toBe('/music/a.flac');
    expect(tempPath).toMatch(/\/music\/\.muzo-tag-.*\.flac$/);
    expect(renameMock).toHaveBeenCalledWith(tempPath, '/music/a.flac');
  });

  it('retries without artwork when the artwork copy fails', async () => {
    let call = 0;
    const { adapter, copy } = build({
      image: { data: Buffer.from('x'), mimeType: 'image/jpeg' },
      copyImpl: async () => {
        if (call++ === 0) throw new Error('bad artwork');
      },
    });
    await adapter.tagInPlace('/music/a.flac', track);

    expect(copy.copyAudioWithMetadata).toHaveBeenCalledTimes(2);
    expect((copy.copyAudioWithMetadata as ReturnType<typeof vi.fn>).mock.calls[1][3]).toBeUndefined();
    expect(renameMock).toHaveBeenCalled();
  });

  it('never throws and cleans up the temp file on total failure', async () => {
    const { adapter } = build({ copyImpl: async () => { throw new Error('ffmpeg gone'); } });
    await expect(adapter.tagInPlace('/music/a.flac', track)).resolves.toBeUndefined();
    expect(unlinkMock).toHaveBeenCalled();
    expect(renameMock).not.toHaveBeenCalled();
  });
});
