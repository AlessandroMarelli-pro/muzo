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
import { spawn } from 'child_process';
import { Response } from 'express';
import * as fs from 'fs';
import { createReadStream, statSync } from 'fs';
import * as path from 'path';

import { GetHiddenTrackUseCase } from 'src/application/use-cases/hidden-music-track';
import { GetTrackUseCase } from 'src/application/use-cases/music-track';
import { HiddenMusicTrackId, MusicTrackId } from 'src/kernel/ids';
import { fromBase64Id } from '../../common/utils/id-encoding';
import { parseHiddenMusicTrackId, parseMusicTrackId } from '../../common/utils/parse-id';
import { HttpAuthGuard } from '../context/http-auth.guard';
import { getContentType } from '../utils/audio-content-type';

@Controller('api/audio')
@UseGuards(HttpAuthGuard)
export class AudioStreamingController {
  constructor(
    private readonly getTrackUseCase: GetTrackUseCase,
    private readonly getHiddenTrackUseCase: GetHiddenTrackUseCase,
  ) {}

  @Get('stream/:trackId')
  async streamAudio(
    @Param('trackId') trackId: MusicTrackId,
    @Res() res: Response,
    @Headers('range') range?: string,
  ): Promise<void> {
    const decodedTrackId = fromBase64Id(trackId);
    const track = await this.getTrackUseCase.execute(parseMusicTrackId(decodedTrackId));

    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }
    const filePath = track.hqAudioPath || track.fileInfo?.filePath;
    this.streamFile(res, range, filePath, track.fileInfo?.fileName, trackId);
  }

  @Get('stream-hidden/:hiddenTrackId')
  async streamHiddenAudio(
    @Param('hiddenTrackId') hiddenTrackId: HiddenMusicTrackId,
    @Res() res: Response,
    @Headers('range') range?: string,
  ): Promise<void> {
    const decodedId = fromBase64Id(hiddenTrackId);
    const track = await this.getHiddenTrackUseCase.execute(parseHiddenMusicTrackId(decodedId));

    if (!track) {
      throw new NotFoundException(`Hidden track with ID ${hiddenTrackId} not found`);
    }
    this.streamFile(res, range, track.fileInfo?.filePath, track.fileInfo?.fileName, hiddenTrackId);
  }

  private streamFile(
    res: Response,
    range: string | undefined,
    filePath: string | undefined,
    fileName: string | undefined,
    idForError: string,
  ): void {
    if (!filePath) {
      throw new BadRequestException(`Track with ID ${idForError} has no file path`);
    }
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`Audio file not found at path: ${filePath}`);
    }

    const fileExtension = path.extname(filePath).toLowerCase();

    // AIFF isn't reliably playable in browsers, so transcode to AAC on the fly.
    // Transcoded output length is unknown up front, so range/seek support is dropped for this path.
    if (fileExtension === '.aiff' || fileExtension === '.aif') {
      const baseName = (fileName || 'audio').replace(/\.\w+$/, '');
      res.set({
        'Cache-Control': 'public, max-age=31536000',
        'Content-Type': 'audio/aac',
        'Content-Disposition': `inline; filename="${encodeURI(baseName)}.aac"`,
      });
      res.status(HttpStatus.OK);

      const ffmpeg = spawn('ffmpeg', [
        '-i',
        filePath,
        '-f',
        'adts',
        '-c:a',
        'aac',
        '-b:a',
        '256k',
        'pipe:1',
      ]);
      ffmpeg.stdout.pipe(res);
      ffmpeg.on('error', () => res.destroy());
      res.on('close', () => ffmpeg.kill('SIGKILL'));
      return;
    }

    const fileSize = statSync(filePath).size;

    // Set appropriate content type based on file extension
    const contentType = getContentType(fileExtension);

    // Set common headers
    res.set({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${encodeURI(fileName || '')}"`,
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
