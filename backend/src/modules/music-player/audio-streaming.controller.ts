import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { createReadStream, statSync } from 'fs';
import * as path from 'path';
import { MusicTrackService } from '../music-track/music-track.service';

@Controller('api/audio')
export class AudioStreamingController {
  constructor(private readonly musicTrackService: MusicTrackService) {}

  @Get('stream/:trackId')
  async streamAudio(
    @Param('trackId') trackId: string,
    @Res() res: Response,
    @Headers('range') range?: string,
  ): Promise<void> {
    const track = await this.musicTrackService.findOne(trackId);

    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }

    if (!fs.existsSync(track.filePath)) {
      throw new BadRequestException(
        `Audio file not found at path: ${track.filePath}`,
      );
    }

    const filePath = track.filePath;
    const fileSize = statSync(filePath).size;
    const fileExtension = path.extname(filePath).toLowerCase();

    // Set appropriate content type based on file extension
    const contentType = this.getContentType(fileExtension);

    // Set common headers
    res.set({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${encodeURI(track.fileName)}"`,
    });

    if (range) {
      // Handle range requests for seeking
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const file = createReadStream(filePath, { start, end });

      res.status(HttpStatus.PARTIAL_CONTENT);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunksize.toString(),
      });

      file.pipe(res);
    } else {
      // Handle full file requests
      const file = createReadStream(filePath);

      res.status(HttpStatus.OK);
      res.set({
        'Content-Length': fileSize.toString(),
      });

      file.pipe(res);
    }
  }

  private getContentType(fileExtension: string): string {
    const contentTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.wma': 'audio/x-ms-wma',
      '.aiff': 'audio/aiff',
      '.au': 'audio/basic',
      '.opus': 'audio/opus',
    };

    return contentTypes[fileExtension] || 'audio/mpeg';
  }
}
