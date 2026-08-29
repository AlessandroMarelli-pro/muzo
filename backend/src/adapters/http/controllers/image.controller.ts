import { Controller, Get, HttpStatus, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import path from 'path';
import { ServeImageUseCase } from 'src/application/use-cases/image/ServeImage';
import { ServeTrackImageUseCase } from 'src/application/use-cases/image/ServeTrackImage';
import { models } from 'src/kernel/types/models';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('api/images')
export class ImageController {
  private readonly logger = new Logger(ImageController.name);
  private readonly defaultImagesDir = path.join(process.cwd(), './default-images');

  constructor(
    private readonly serveImageUseCase: ServeImageUseCase,
    private readonly serveTrackImageUseCase: ServeTrackImageUseCase,
  ) {}

  /**
   * Serve a cover image.
   *
   * `imagePath` (or `trackId`) is a track id: the optimized cover-art bytes are
   * stored in Postgres (image_searches.image_data) by the ai-service ingestion
   * path, since the ai-service filesystem is not shared with the backend.
   * Falsy / "Unknown Image" / "undefined" fall back to a random bundled default.
   */
  @Get('serve')
  async serveImage(
    @Res() res: Response,
    @Query('imagePath') imagePath?: string,
    @Query('trackId') trackIdParam?: string,
  ): Promise<void> {
    const raw = trackIdParam || imagePath;
    try {
      if (!raw || raw.includes('Unknown Image') || raw === 'undefined') {
        return await this.serveDefault(res);
      }

      const decoded = decodeURIComponent(raw);
      if (!UUID_RE.test(decoded)) {
        // Legacy value (an old filesystem path). Nothing on disk to serve.
        return await this.serveDefault(res);
      }

      const image = await this.serveTrackImageUseCase.execute(models.musicTrack.id(decoded));
      if (!image) {
        return await this.serveDefault(res);
      }

      res.set({
        'Content-Type': image.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': image.data.length.toString(),
      });
      res.send(image.data);
    } catch (error) {
      this.logger.error(`Error serving image ${raw}:`, error);
      res.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Image not found: ${raw}`,
        error: 'Not Found',
      });
    }
  }

  private async serveDefault(res: Response): Promise<void> {
    const defaultImages = ['default_1.jpg', 'default_2.jpg', 'default_3.jpg'];
    const randomImage = defaultImages[Math.floor(Math.random() * defaultImages.length)];
    const fullPath = path.join(this.defaultImagesDir, randomImage);
    const buffer = await this.serveImageUseCase.execute(fullPath, true);
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-cache',
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  }
}
