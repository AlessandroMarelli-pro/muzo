import { EventEmitter } from 'events';
import { isLosslessCodec, probeAudioCodec } from 'src/infrastructure/hq-audio/audio-probe';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock('child_process', () => ({ spawn: spawnMock }));

function fakeFfprobe(exitCode: number, stdout: string) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  setImmediate(() => {
    if (stdout) proc.stdout.emit('data', stdout);
    proc.emit('close', exitCode);
  });
  return proc;
}

describe('isLosslessCodec', () => {
  it.each(['flac', 'ALAC', 'pcm_s16le', 'wavpack'])('true for %s', (c) => {
    expect(isLosslessCodec(c)).toBe(true);
  });
  it.each(['aac', 'mp3', 'opus', 'vorbis', '', null, undefined])('false for %s', (c) => {
    expect(isLosslessCodec(c)).toBe(false);
  });
});

describe('probeAudioCodec', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parses codec + sample rate and flags lossless', async () => {
    spawnMock.mockReturnValue(
      fakeFfprobe(0, JSON.stringify({ streams: [{ codec_name: 'flac', sample_rate: '44100' }] })),
    );
    expect(await probeAudioCodec('/x.flac')).toEqual({
      codec: 'flac',
      sampleRate: 44100,
      lossless: true,
    });
  });

  it('flags AAC as lossy', async () => {
    spawnMock.mockReturnValue(
      fakeFfprobe(0, JSON.stringify({ streams: [{ codec_name: 'aac', sample_rate: '44100' }] })),
    );
    const r = await probeAudioCodec('/x.m4a');
    expect(r).toMatchObject({ codec: 'aac', lossless: false });
  });

  it('returns null on ffprobe failure', async () => {
    spawnMock.mockReturnValue(fakeFfprobe(1, ''));
    expect(await probeAudioCodec('/x')).toBeNull();
  });

  it('returns null when ffprobe is missing', async () => {
    const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    setImmediate(() => proc.emit('error', new Error('ENOENT')));
    spawnMock.mockReturnValue(proc);
    expect(await probeAudioCodec('/x')).toBeNull();
  });
});
