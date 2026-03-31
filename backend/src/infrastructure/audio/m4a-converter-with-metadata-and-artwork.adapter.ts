import { Inject, Injectable } from '@nestjs/common';
import { spawn } from 'child_process';

import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import {
  IM4AConverterWithMetadataAndArtwork,
} from 'src/application/ports/infrastructure/IM4AConverterWithMetadataAndArtwork';
import type { WavMetadata } from 'src/application/ports/infrastructure/IWavConverterWithMetadata';

const AAC_BITRATE = '320k';

@Injectable()
export class M4aConverterWithMetadataAndArtwork
  implements IM4AConverterWithMetadataAndArtwork
{
  constructor(
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('M4aConverterWithMetadataAndArtwork');
  }

  private async runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      let stderr = '';
      ffmpegProcess.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      ffmpegProcess.on('error', (err) => {
        reject(err);
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        const tail = stderr.split('\n').slice(-40).join('\n');
        reject(new Error(`ffmpeg exited with code ${code}\n${tail}`));
      });
    });
  }

  async convertToM4aWithMetadata(
    inputPath: string,
    outputPath: string,
    metadata: WavMetadata,
  ): Promise<void> {
    this.logger.debug('M4aConverterWithMetadataAndArtwork: converting (no artwork)', {
      inputPath,
      outputPath,
    });

    const args: string[] = [
      '-y',
      '-i',
      inputPath,
      '-map_metadata',
      '0',
      '-map',
      '0:a:0',
      '-c:a',
      'aac',
      '-b:a',
      AAC_BITRATE,
      '-metadata',
      `artist=${metadata.artist}`,
      '-metadata',
      `title=${metadata.title}`,
      '-metadata',
      `genre=${metadata.genre}`,
      '-metadata',
      `comment=${metadata.comment}`,
      '-movflags',
      '+faststart',
      '-f',
      'ipod',
      outputPath,
    ];

    await this.runFfmpeg(args);
  }

  async convertToM4aWithMetadataAndArtwork(
    inputPath: string,
    outputPath: string,
    metadata: WavMetadata,
    artworkPath: string,
  ): Promise<void> {
    this.logger.debug('M4aConverterWithMetadataAndArtwork: converting (with artwork)', {
      inputPath,
      outputPath,
      artworkPath,
    });

    const args: string[] = [
      '-y',
      '-i',
      inputPath,
      '-i',
      artworkPath,
      '-map_metadata',
      '0',
      '-map',
      '0:a:0',
      '-map',
      '1:v:0',
      '-c:a',
      'aac',
      '-b:a',
      AAC_BITRATE,
      '-c:v',
      'copy',
      '-disposition:v:0',
      'attached_pic',
      '-metadata',
      `artist=${metadata.artist}`,
      '-metadata',
      `title=${metadata.title}`,
      '-metadata',
      `genre=${metadata.genre}`,
      '-metadata',
      `comment=${metadata.comment}`,
      '-movflags',
      '+faststart',
      '-f',
      'ipod',
      outputPath,
    ];

    await this.runFfmpeg(args);
  }
}

