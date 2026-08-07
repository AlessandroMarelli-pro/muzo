import { registerAs } from '@nestjs/config';
import * as os from 'os';
import * as path from 'path';

export interface HqAudioConfig {
  slskd: {
    url: string;
    apiKey: string;
    downloadPath: string;
    searchTimeoutMs: number;
  };
  sockseek: {
    binaryPath: string;
    configPath: string;
    timeoutMs: number;
    outputDir: string;
    nicotinePlusDataDir: string;
    fastSearch: boolean;
    searchTimeoutMs: number;
  };
  tidal: {
    outputDir: string;
  };
}

export default registerAs(
  'hqAudio',
  (): HqAudioConfig => ({
    slskd: {
      url: process.env.SLSKD_URL || 'http://localhost:5030',
      apiKey: process.env.SLSKD_API_KEY || '',
      downloadPath: process.env.SLSKD_DOWNLOAD_PATH || '',
      searchTimeoutMs: parseInt(process.env.SLSKD_SEARCH_TIMEOUT_MS || '30000', 10),
    },
    sockseek: {
      binaryPath: process.env.SOCKSEEK_BINARY_PATH || 'sockseek',
      configPath: process.env.SOCKSEEK_CONFIG_PATH || '',
      timeoutMs: parseInt(process.env.SOCKSEEK_TIMEOUT_MS || '240000', 10),
      outputDir: process.env.SOCKSEEK_OUTPUT_DIR || path.join(os.homedir(), 'Music', 'Soulseek'),
      nicotinePlusDataDir:
        process.env.NICOTINE_PLUS_DATA_DIR || path.join(os.homedir(), '.local', 'share', 'nicotine'),
      fastSearch: process.env.SOCKSEEK_FAST_SEARCH === 'true',
      searchTimeoutMs: parseInt(process.env.SOCKSEEK_SEARCH_TIMEOUT_MS || '30000', 10),
    },
    tidal: {
      outputDir: process.env.TIDAL_OUTPUT_DIR || path.join(os.homedir(), 'Music', 'Tidal'),
    },
  }),
);
