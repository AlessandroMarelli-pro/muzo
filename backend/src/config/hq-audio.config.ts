import { registerAs } from '@nestjs/config';
import * as os from 'os';
import * as path from 'path';

export interface HqAudioConfig {
  sockseek: {
    binaryPath: string;
    configPath: string;
    timeoutMs: number;
    /** Base timeout for a batch run, added to perTrackTimeoutMs * trackCount. */
    batchBaseTimeoutMs: number;
    /** Additional per-track allowance for batch runs, so large batches get proportionally more time. */
    batchPerTrackTimeoutMs: number;
    outputDir: string;
    nicotinePlusDataDir: string;
    fastSearch: boolean;
    searchTimeoutMs: number;
  };
  tidal: {
    outputDir: string;
  };
  universr: {
    outputDir: string;
    timeoutMs: number;
  };
}

export default registerAs(
  'hqAudio',
  (): HqAudioConfig => ({
    sockseek: {
      binaryPath: process.env.SOCKSEEK_BINARY_PATH || 'sockseek',
      configPath: process.env.SOCKSEEK_CONFIG_PATH || '',
      timeoutMs: parseInt(process.env.SOCKSEEK_TIMEOUT_MS || '240000', 10),
      batchBaseTimeoutMs: parseInt(process.env.SOCKSEEK_BATCH_BASE_TIMEOUT_MS || '120000', 10),
      batchPerTrackTimeoutMs: parseInt(
        process.env.SOCKSEEK_BATCH_PER_TRACK_TIMEOUT_MS || '30000',
        10,
      ),
      outputDir: process.env.SOCKSEEK_OUTPUT_DIR || path.join(os.homedir(), 'Music', 'Soulseek'),
      nicotinePlusDataDir:
        process.env.NICOTINE_PLUS_DATA_DIR || path.join(os.homedir(), '.local', 'share', 'nicotine'),
      fastSearch: process.env.SOCKSEEK_FAST_SEARCH === 'true',
      searchTimeoutMs: parseInt(process.env.SOCKSEEK_SEARCH_TIMEOUT_MS || '30000', 10),
    },
    tidal: {
      outputDir: process.env.TIDAL_OUTPUT_DIR || path.join(os.homedir(), 'Music', 'Tidal'),
    },
    universr: {
      outputDir: process.env.UNIVERSR_OUTPUT_DIR || path.join(os.homedir(), 'Music', 'Enhanced'),
      // Real full-length mono tracks (4-5 min) measured ~11-12 min end-to-end
      // (HF Job cold-start + chunked GPU inference + upload/download). 10min
      // was too tight and caused the backend to abandon an already-completed
      // enhancement. Stereo tracks are enhanced per-channel (roughly 2x GPU
      // time); the ai-service job itself is capped at 30min
      // (UNIVERSR_JOB_TIMEOUT), so this must exceed that plus upload/download
      // overhead.
      timeoutMs: parseInt(process.env.UNIVERSR_TIMEOUT_MS || '2400000', 10),
    },
  }),
);
