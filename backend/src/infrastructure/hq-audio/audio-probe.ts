import { spawn } from 'child_process';

export interface ProbedAudio {
  codec: string;
  sampleRate: number | null;
  /** True when the codec carries no generation loss (FLAC, ALAC, PCM, ...). */
  lossless: boolean;
}

/**
 * Codecs that are genuinely lossless. Notably AAC/MP3/Opus/Vorbis are NOT here:
 * Tidal without a HiFi entitlement serves 320 kbps AAC in an `.m4a` container,
 * which must not be treated as HQ.
 */
const LOSSLESS_CODECS = new Set([
  'flac',
  'alac',
  'pcm_s16le',
  'pcm_s16be',
  'pcm_s24le',
  'pcm_s24be',
  'pcm_s32le',
  'pcm_f32le',
  'pcm_f64le',
  'wavpack',
  'ape',
  'tta',
  'tak',
]);

export function isLosslessCodec(codec: string | undefined | null): boolean {
  return !!codec && LOSSLESS_CODECS.has(codec.toLowerCase());
}

/**
 * Runs `ffprobe` on the first audio stream of `filePath`. Returns null if
 * ffprobe is unavailable or the file can't be read — callers decide how to
 * treat "unknown" (the HQ pipeline treats it as non-lossless to stay safe).
 */
export async function probeAudioCodec(filePath: string): Promise<ProbedAudio | null> {
  return new Promise((resolve) => {
    const args = [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_name,sample_rate',
      '-of',
      'json',
      filePath,
    ];
    const cmd = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    cmd.stdout.on('data', (c) => {
      stdout += String(c);
    });
    cmd.on('error', () => resolve(null));
    cmd.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as {
          streams?: Array<{ codec_name?: string; sample_rate?: string }>;
        };
        const stream = parsed.streams?.[0];
        if (!stream?.codec_name) {
          resolve(null);
          return;
        }
        const sr = stream.sample_rate ? Number.parseInt(stream.sample_rate, 10) : null;
        resolve({
          codec: stream.codec_name.toLowerCase(),
          sampleRate: Number.isFinite(sr) ? sr : null,
          lossless: isLosslessCodec(stream.codec_name),
        });
      } catch {
        resolve(null);
      }
    });
  });
}
