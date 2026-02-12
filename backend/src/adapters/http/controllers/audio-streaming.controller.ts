import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { createReadStream, statSync } from 'fs';
import * as path from 'path';

import { GetTrackUseCase } from 'src/application/use-cases/music-track';
import { MusicTrackId } from 'src/kernel/ids';
import { fromBase64Id } from '../../common/utils/id-encoding';
import { parseMusicTrackId } from '../../common/utils/parse-id';
import { HttpAuthGuard } from '../context/http-auth.guard';
import { getContentType } from '../utils/audio-content-type';

@Controller('api/audio')
@UseGuards(HttpAuthGuard)
export class AudioStreamingController {
  constructor(private readonly getTrackUseCase: GetTrackUseCase) {}

  @Get('stream/:trackId')
  async streamAudio(
    @Param('trackId') trackId: MusicTrackId,
    @Res() res: Response,
    @Headers('range') range?: string,
  ): Promise<void> {
    const decodedTrackId = fromBase64Id(trackId);

    const track = await this.getTrackUseCase.execute(
      parseMusicTrackId(decodedTrackId),
    );

    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }
    const filePath = track.fileInfo?.filePath;
    if (!filePath) {
      throw new BadRequestException(
        `Track with ID ${trackId} has no file path`,
      );
    }
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(
        `Audio file not found at path: ${filePath}`,
      );
    }

    const fileSize = statSync(filePath).size;
    const fileExtension = path.extname(filePath).toLowerCase();

    // Set appropriate content type based on file extension
    const contentType = getContentType(fileExtension);

    // Set common headers
    res.set({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${encodeURI(track.fileInfo?.fileName || '')}"`,
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
}
