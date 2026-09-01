import { EventEmitter } from 'events';

import { CopyAudioWithMetadata } from 'src/infrastructure/audio/copy-audio-with-metadata.adapter';
import type { AudioArtwork } from 'src/application/ports/infrastructure/ICopyAudioWithMetadata';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import type { WavMetadata } from 'src/application/ports/infrastructure/IWavConverterWithMetadata';

const noopLogger: ILogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;

type FakeChildProcess = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
};

function makeFakeChildProcess(): FakeChildProcess {
  const emitter = new EventEmitter() as FakeChildProcess;
  emitter.stdout = new EventEmitter();
  emitter.stderr = new EventEmitter();
  return emitter;
}

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock('child_process', () => ({
  spawn: spawnMock,
}));

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  };
});

const fsPromises = await import('fs/promises');

const metadata: WavMetadata = {
  artist: 'Some Artist',
  title: 'Some Title',
  genre: '#house',
  style: '#deep house',
  comment: '#house, #deep house',
};

const jpegArtwork: AudioArtwork = {
  // JPEG magic bytes (SOI marker) so getImageMimeTypeFromBytes sniffs image/jpeg.
  data: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]),
  mimeType: 'image/jpeg',
};

describe('CopyAudioWithMetadata', () => {
  let capturedArgs: string[][];
  let adapter: CopyAudioWithMetadata;

  beforeEach(() => {
    capturedArgs = [];
    spawnMock.mockReset();
    vi.mocked(fsPromises.writeFile).mockClear();
    vi.mocked(fsPromises.unlink).mockClear();
    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      capturedArgs.push(args);
      const child = makeFakeChildProcess();
      // Resolve success asynchronously, like the real process would.
      queueMicrotask(() => child.emit('close', 0));
      return child;
    });

    adapter = new CopyAudioWithMetadata({ createLogger: () => noopLogger }, noopLogger);
  });

  it('embeds a picture stream for flac output when artwork is present', async () => {
    await adapter.copyAudioWithMetadata('/in/track.flac', '/out/track.flac', metadata, jpegArtwork);

    const args = capturedArgs[0];
    expect(args).toContain('-map');
    expect(args.join(' ')).toContain('1:v:0');
    expect(args).toContain('attached_pic');
    expect(args).not.toContain('METADATA_BLOCK_PICTURE=');
    expect(args.some((a) => a.startsWith('METADATA_BLOCK_PICTURE='))).toBe(false);
  });

  it('embeds a picture stream with id3v2.3 for mp3 output', async () => {
    await adapter.copyAudioWithMetadata('/in/track.mp3', '/out/track.mp3', metadata, jpegArtwork);

    const args = capturedArgs[0];
    expect(args.join(' ')).toContain('1:v:0');
    expect(args).toContain('attached_pic');
    expect(args).toContain('-id3v2_version');
    expect(args).toContain('3');
  });

  it('embeds a picture stream for m4a output', async () => {
    await adapter.copyAudioWithMetadata('/in/track.m4a', '/out/track.m4a', metadata, jpegArtwork);

    const args = capturedArgs[0];
    expect(args.join(' ')).toContain('1:v:0');
    expect(args).toContain('attached_pic');
    expect(args).toContain('-movflags');
  });

  it('uses the base64 METADATA_BLOCK_PICTURE tag for opus, with no second input', async () => {
    await adapter.copyAudioWithMetadata('/in/track.opus', '/out/track.opus', metadata, jpegArtwork);

    const args = capturedArgs[0];
    // Only one -i (the audio input); no picture-stream mapping.
    expect(args.filter((a) => a === '-i')).toHaveLength(1);
    expect(args).not.toContain('1:v:0');
    expect(args.some((a) => a.startsWith('METADATA_BLOCK_PICTURE='))).toBe(true);
  });

  it('writes no artwork at all for wav output', async () => {
    await adapter.copyAudioWithMetadata('/in/track.wav', '/out/track.wav', metadata, jpegArtwork);

    const args = capturedArgs[0];
    expect(args.filter((a) => a === '-i')).toHaveLength(1);
    expect(args).not.toContain('attached_pic');
    expect(args.some((a) => a.startsWith('METADATA_BLOCK_PICTURE='))).toBe(false);
  });

  it('skips artwork entirely when none is provided', async () => {
    await adapter.copyAudioWithMetadata('/in/track.flac', '/out/track.flac', metadata, undefined);

    const args = capturedArgs[0];
    expect(args.filter((a) => a === '-i')).toHaveLength(1);
    expect(args).not.toContain('attached_pic');
  });

  it('cleans up the temp image file even when ffmpeg fails', async () => {
    spawnMock.mockImplementation(() => {
      const child = makeFakeChildProcess();
      queueMicrotask(() => {
        child.stderr.emit('data', Buffer.from('boom'));
        child.emit('close', 1);
      });
      return child;
    });

    await expect(
      adapter.copyAudioWithMetadata('/in/track.flac', '/out/track.flac', metadata, jpegArtwork),
    ).rejects.toThrow(/ffmpeg exited with code 1/);

    expect(fsPromises.unlink).toHaveBeenCalledTimes(1);
  });
});
