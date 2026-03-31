import { Inject, Injectable } from '@nestjs/common';
import { spawn } from 'child_process';

import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import {
  IWavConverterWithMetadata,
  WavMetadata,
} from 'src/application/ports/infrastructure/IWavConverterWithMetadata';

@Injectable()
export class WavConverterWithMetadata implements IWavConverterWithMetadata {
  constructor(
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('WavConverterWithMetadata');
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

        const tail = stderr.split('\n').slice(-30).join('\n');
        reject(
          new Error(
            `ffmpeg exited with code ${code}\n${tail ? `stderr tail:\n${tail}` : 'no stderr tail available'}`,
          ),
        );
      });
    });
  }

  async convertToWavWithMetadata(inputPath: string, outputPath: string, metadata: WavMetadata) {
    this.logger.info('WavConverterWithMetadata: converting', {
      inputPath,
      outputPath,
      genre: metadata.genre,
    });

    const args: string[] = [
      '-y',
      '-i',
      inputPath,
      // Output option: copy container metadata from input.
      // Must come after the input file argument so ffmpeg can apply it correctly.
      '-map_metadata',
      '0',
      '-c:a',
      'pcm_s16le',
      '-metadata',
      `artist=${metadata.artist}`,
      '-metadata',
      `title=${metadata.title}`,
      '-metadata',
      `genre=${metadata.genre}`,
      '-metadata',
      `comment=${metadata.comment}`,
      '-f',
      'wav',
      outputPath,
    ];

    try {
      await this.runFfmpeg(args);
      this.logger.info('WavConverterWithMetadata: conversion ok', { outputPath });
    } catch (err) {
      this.logger.error('WavConverterWithMetadata: conversion failed', {
        inputPath,
        outputPath,
        message: (err as Error | undefined)?.message ?? undefined,
        error: String(err),
      });
      throw err;
    }
  }

  async convertToWav(inputPath: string, outputPath: string): Promise<void> {
    this.logger.info('WavConverterWithMetadata: converting (no metadata)', {
      inputPath,
      outputPath,
    });

    const args: string[] = [
      '-y',
      '-i',
      inputPath,
      '-c:a',
      'pcm_s16le',
      '-f',
      'wav',
      outputPath,
    ];

    try {
      await this.runFfmpeg(args);
      this.logger.info('WavConverterWithMetadata: conversion ok (no metadata)', { outputPath });
    } catch (err) {
      this.logger.error('WavConverterWithMetadata: conversion failed (no metadata)', {
        inputPath,
        outputPath,
        message: (err as Error | undefined)?.message ?? undefined,
        error: String(err),
      });
      throw err;
    }
  }
}
