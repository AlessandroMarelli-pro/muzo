import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import path from 'path';
import { ImageSearchResult, ImageService } from './image.service';

export interface SearchImageRequest {
  trackId: string;
}

export interface BatchSearchRequest {
  trackIds: string[];
}

@Controller('api/images')
export class ImageController {
  private readonly logger = new Logger(ImageController.name);
  private readonly defaultImagesDir = path.join(
    process.cwd(),
    './default-images',
  );

  constructor(private readonly imageService: ImageService) {}

  /**
   * Health check endpoint
   */
  @Get('health')
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Serve image file
   */
  @Get('serve')
  async serveImage(
    @Query('imagePath') imagePath: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      let isDefault = false;
      if (
        imagePath.includes('Unknown Image') ||
        !imagePath ||
        imagePath === 'undefined'
      ) {
        // Return one random of default_1, default_2, default_3 from default-images folder
        const defaultImages = [
          'default_1.jpg',
          'default_2.jpg',
          'default_3.jpg',
        ];
        const randomImage =
          defaultImages[Math.floor(Math.random() * defaultImages.length)];
        imagePath = path.join(this.defaultImagesDir, randomImage);
        isDefault = true;
      }

      const imageBuffer = await this.imageService.serveImage(
        imagePath,
        isDefault,
      );

      // Determine content type based on file extension
      const contentType = imagePath.endsWith('.svg')
        ? 'image/svg+xml'
        : 'image/jpeg';

      // Browser caching: 1 year for track images, no cache for random default
      res.set({
        'Content-Type': contentType,
        ...(!isDefault
          ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
          : { 'Cache-Control': 'no-cache' }),
        'Content-Length': imageBuffer.length.toString(),
      });

      res.send(imageBuffer);
    } catch (error) {
      this.logger.error(`Error serving image ${imagePath}:`, error);
      res.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Image not found: ${imagePath}`,
        error: 'Not Found',
      });
    }
  }

  /**
   * Get image for a specific track
   */
  @Get('track/:trackId')
  async getImageForTrack(
    @Param('trackId') trackId: string,
  ): Promise<ImageSearchResult | null> {
    try {
      return await this.imageService.getImageForTrack(trackId);
    } catch (error) {
      this.logger.error(`Error getting image for track ${trackId}:`, error);
      throw error;
    }
  }

  /**
   * Get image URL for a specific track
   */
  @Get('track/:trackId/url')
  async getImageUrl(
    @Param('trackId') trackId: string,
  ): Promise<{ url: string | null }> {
    try {
      const url = await this.imageService.getImageUrl(trackId);
      return { url };
    } catch (error) {
      this.logger.error(`Error getting image URL for track ${trackId}:`, error);
      throw error;
    }
  }

  /**
   * Get image search status
   */
  @Get('search/:searchId/status')
  async getImageSearchStatus(
    @Param('searchId') searchId: string,
  ): Promise<ImageSearchResult | null> {
    try {
      return await this.imageService.getImageSearchStatus(searchId);
    } catch (error) {
      this.logger.error(`Error getting search status for ${searchId}:`, error);
      throw error;
    }
  }

  /**
   * Get all image searches for a track
   */
  @Get('track/:trackId/searches')
  async getImageSearchesForTrack(
    @Param('trackId') trackId: string,
  ): Promise<ImageSearchResult[]> {
    try {
      return await this.imageService.getImageSearchesForTrack(trackId);
    } catch (error) {
      this.logger.error(
        `Error getting image searches for track ${trackId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete image for a track
   */
  @Post('track/:trackId/delete')
  async deleteImageForTrack(
    @Param('trackId') trackId: string,
  ): Promise<{ success: boolean }> {
    try {
      const success = await this.imageService.deleteImageForTrack(trackId);
      return { success };
    } catch (error) {
      this.logger.error(`Error deleting image for track ${trackId}:`, error);
      throw error;
    }
  }
}
