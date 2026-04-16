import { registerAs } from '@nestjs/config';

export interface HqAudioConfig {
  outputDir: string;
  slskd: {
    url: string;
    apiKey: string;
    downloadPath: string;
    searchTimeoutMs: number;
  };
}

export default registerAs(
  'hqAudio',
  (): HqAudioConfig => ({
    outputDir: process.env.HQ_AUDIO_OUTPUT_DIR || '/tmp/muzo-hq-audio',
    slskd: {
      url: process.env.SLSKD_URL || 'http://localhost:5030',
      apiKey: process.env.SLSKD_API_KEY || '',
      downloadPath: process.env.SLSKD_DOWNLOAD_PATH || '',
      searchTimeoutMs: parseInt(process.env.SLSKD_SEARCH_TIMEOUT_MS || '30000', 10),
    },
  }),
);
