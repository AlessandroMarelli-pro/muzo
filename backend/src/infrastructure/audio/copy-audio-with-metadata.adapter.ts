import { Inject, Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

import { ICopyAudioWithMetadata } from 'src/application/ports/infrastructure/ICopyAudioWithMetadata';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import type { WavMetadata } from 'src/application/ports/infrastructure/IWavConverterWithMetadata';

@Injectable()
export class CopyAudioWithMetadata implements ICopyAudioWithMetadata {
  constructor(
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('CopyAudioWithMetadata');
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

      ffmpegProcess.on('error', (err) => reject(err));

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

  private async readOpusPictureMetadata(inputPath: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const ffprobeArgs = [
        '-v',
        'error',
        '-show_entries',
        'format_tags:stream_tags',
        '-of',
        'json',
        inputPath,
      ];
      const ffprobeProcess = spawn('ffprobe', ffprobeArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      ffprobeProcess.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      ffprobeProcess.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      ffprobeProcess.on('error', (err) => reject(err));

      ffprobeProcess.on('close', (code) => {
        if (code !== 0) {
          const tail = stderr.split('\n').slice(-30).join('\n');
          reject(new Error(`ffprobe exited with code ${code}\n${tail}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as {
            format?: { tags?: Record<string, string> };
            streams?: Array<{ tags?: Record<string, string> }>;
          };
          const formatTags = parsed.format?.tags ?? {};
          const streamTags = (parsed.streams ?? []).flatMap((s) => (s.tags ? [s.tags] : []));

          const fromFormat =
            formatTags.METADATA_BLOCK_PICTURE ?? formatTags.metadata_block_picture ?? null;
          const fromStream =
            streamTags
              .map((tags) => tags.METADATA_BLOCK_PICTURE ?? tags.metadata_block_picture ?? null)
              .find((v) => Boolean(v)) ?? null;
          const picture = fromFormat ?? fromStream;
          resolve(picture);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private resolveImagePath(imagePath: string): string {
    return imagePath;
  }

  // The file extension is not trustworthy: images saved from embedded audio
  // artwork have been observed with a `.png` extension while actually
  // containing JPEG bytes. Sniff the magic bytes instead, so the MIME type
  // written into the picture block matches the real image data.
  private getImageMimeTypeFromBytes(imageBytes: Buffer): string | null {
    if (imageBytes.length >= 3 && imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff) {
      return 'image/jpeg';
    }
    if (
      imageBytes.length >= 8 &&
      imageBytes[0] === 0x89 &&
      imageBytes[1] === 0x50 &&
      imageBytes[2] === 0x4e &&
      imageBytes[3] === 0x47
    ) {
      return 'image/png';
    }
    if (
      imageBytes.length >= 12 &&
      imageBytes.toString('ascii', 0, 4) === 'RIFF' &&
      imageBytes.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return 'image/webp';
    }
    if (
      imageBytes.length >= 6 &&
      (imageBytes.toString('ascii', 0, 6) === 'GIF87a' || imageBytes.toString('ascii', 0, 6) === 'GIF89a')
    ) {
      return 'image/gif';
    }
    return null;
  }

  private getImageMimeTypeFromExtension(imagePath: string): string {
    const ext = path.extname(imagePath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') {
      return 'image/jpeg';
    }
    if (ext === '.webp') {
      return 'image/webp';
    }
    if (ext === '.gif') {
      return 'image/gif';
    }
    return 'image/png';
  }

  private buildFlacPictureBlockBase64(imageBytes: Buffer, mimeType: string): string {
    // Build FLAC picture block (type=3 front cover), then base64 encode for Vorbis tag.
    const type = Buffer.alloc(4);
    type.writeUInt32BE(3, 0);

    const mime = Buffer.from(mimeType, 'utf8');
    const mimeLength = Buffer.alloc(4);
    mimeLength.writeUInt32BE(mime.length, 0);

    const description = Buffer.alloc(4); // empty description length=0
    const width = Buffer.alloc(4); // unknown -> 0
    const height = Buffer.alloc(4); // unknown -> 0
    const depth = Buffer.alloc(4); // unknown -> 0
    const colors = Buffer.alloc(4); // unknown -> 0

    const dataLength = Buffer.alloc(4);
    dataLength.writeUInt32BE(imageBytes.length, 0);

    return Buffer.concat([
      type,
      mimeLength,
      mime,
      description,
      width,
      height,
      depth,
      colors,
      dataLength,
      imageBytes,
    ]).toString('base64');
  }

  private async readPictureMetadataFromDbImagePath(imagePath?: string): Promise<string | null> {
    if (!imagePath) {
      return null;
    }

    try {
      const absolutePath = this.resolveImagePath(imagePath);
      const imageBytes = await fs.readFile(absolutePath);
      const mimeType =
        this.getImageMimeTypeFromBytes(imageBytes) ?? this.getImageMimeTypeFromExtension(absolutePath);
      return this.buildFlacPictureBlockBase64(imageBytes, mimeType);
    } catch (err) {
      this.logger.warn('CopyAudioWithMetadata: failed to read DB image for picture metadata', {
        imagePath,
        error: String(err),
      });
      return null;
    }
  }

  async copyAudioWithMetadata(
    inputPath: string,
    outputPath: string,
    metadata: WavMetadata,
    imagePath?: string,
  ): Promise<void> {
    this.logger.debug('CopyAudioWithMetadata: copying with metadata', {
      inputPath,
      outputPath,
    });

    const ext = outputPath.split('.').pop()?.toLowerCase() ?? '';
    const isOpusLike = ext === 'opus' || ext === 'ogg';
    const mapMetadataValue = isOpusLike ? '-1' : '0';
    let opusPictureMetadata: string | null = null;

    if (isOpusLike) {
      opusPictureMetadata = await this.readPictureMetadataFromDbImagePath(imagePath);

      if (!opusPictureMetadata) {
        // Fallback to existing embedded artwork in source file if DB image is unavailable.
        try {
          opusPictureMetadata = await this.readOpusPictureMetadata(inputPath);
        } catch (err) {
          this.logger.warn('CopyAudioWithMetadata: failed to read OPUS picture metadata', {
            inputPath,
            error: String(err),
          });
        }
      }
    }

    // -map_metadata 0 copies existing metadata; -metadata overrides selected fields.
    // For OPUS, write both COMMENT and DESCRIPTION for wider software compatibility.
    const args: string[] = [
      '-y',
      '-i',
      inputPath,
      '-map_metadata',
      mapMetadataValue,
      // Only copy the audio stream. Inputs may contain attached pics/video streams
      // which are not supported in the chosen container (e.g. opus).
      '-map',
      '0:a:0',
      '-c',
      'copy',
      '-metadata',
      `artist=${metadata.artist}`,
      '-metadata',
      `title=${metadata.title}`,
      '-metadata',
      `genre=${metadata.genre}`,
      '-metadata',
      `style=${metadata.style}`,
      '-metadata',
      `label=${metadata.style}`,
      '-metadata',
      `comment=${metadata.comment}`,
      '-metadata',
      `description=${metadata.comment}`,
      '-metadata',
      `synopsis=${metadata.comment}`,
    ];

    if (isOpusLike) {
      const escapedComment = metadata.comment.replace(/\r?\n/g, ' ');
      const escapedStyle = metadata.style.replace(/\r?\n/g, ' ');
      args.push('-metadata', `STYLE=${metadata.style}`);
      args.push('-metadata', `LABEL=${metadata.style}`);
      args.push('-metadata', `COMMENT=${metadata.comment}`);
      args.push('-metadata', `comment=${metadata.comment}`);
      args.push('-metadata', `COMM=${metadata.comment}`);
      args.push('-metadata', `COMMENTS=${metadata.comment}`);
      args.push('-metadata', `DESCRIPTION=${metadata.comment}`);
      args.push('-metadata', `SYNOPSIS=${metadata.comment}`);
      args.push('-metadata', `GENRE=${metadata.genre}`);
      args.push('-metadata', `GENRES=${metadata.genre}`);
      args.push('-metadata', `ARTIST=${metadata.artist}`);
      args.push('-metadata', `TITLE=${metadata.title}`);
      // Some players read OPUS Vorbis comments from stream-level tags.
      args.push('-metadata:s:a:0', `STYLE=${metadata.style}`);
      args.push('-metadata:s:a:0', `LABEL=${metadata.style}`);
      args.push('-metadata:s:a:0', `label=${escapedStyle}`);
      args.push('-metadata:s:a:0', `COMMENT=${escapedComment}`);
      args.push('-metadata:s:a:0', `comment=${escapedComment}`);
      args.push('-metadata:s:a:0', `COMM=${escapedComment}`);
      args.push('-metadata:s:a:0', `COMMENTS=${escapedComment}`);
      args.push('-metadata:s:a:0', `DESCRIPTION=${escapedComment}`);
      args.push('-metadata:s:a:0', `description=${escapedComment}`);
      args.push('-metadata:s:a:0', `SYNOPSIS=${escapedComment}`);
      args.push('-metadata:s:a:0', `synopsis=${escapedComment}`);
      args.push('-metadata:s:a:0', `GENRE=${metadata.genre}`);
      args.push('-metadata:s:a:0', `GENRES=${metadata.genre}`);
      args.push('-metadata:s:a:0', `ARTIST=${metadata.artist}`);
      args.push('-metadata:s:a:0', `TITLE=${metadata.title}`);
      if (opusPictureMetadata) {
        args.push('-metadata', `METADATA_BLOCK_PICTURE=${opusPictureMetadata}`);
        args.push('-metadata:s:a:0', `METADATA_BLOCK_PICTURE=${opusPictureMetadata}`);
      }
    }

    args.push(outputPath);

    await this.runFfmpeg(args);
  }

  async copyAudio(inputPath: string, outputPath: string): Promise<void> {
    this.logger.debug('CopyAudioWithMetadata: copying (no metadata override)', {
      inputPath,
      outputPath,
    });

    const args: string[] = [
      '-y',
      '-i',
      inputPath,
      '-map',
      '0:a:0',
      '-c',
      'copy',
      '-map_metadata',
      '0',
      outputPath,
    ];
    await this.runFfmpeg(args);
  }
}
