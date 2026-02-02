import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ImageSearchStatus } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Browser } from 'puppeteer';
import { PrismaService } from '../../shared/services/prisma.service';
import { SimpleAlbumArt } from '../ai-integration/ai-service-simple.types';

export interface ImageSearchParams {
  artist?: string;
  album?: string;
  title?: string;
}

export interface ImageSearchResult {
  id: string;
  trackId: string;
  searchUrl: string;
  status: 'pending' | 'completed' | 'failed';
  imagePath?: string;
  imageUrl?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);
  private readonly imagesDir = path.join(process.cwd(), '../muzo/images');

  private browser: Browser | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.ensureImagesDirectory();
  }

  private async ensureImagesDirectory(): Promise<void> {
    try {
      await fs.access(this.imagesDir);
    } catch {
      await fs.mkdir(this.imagesDir, { recursive: true });
      this.logger.log(`Created images directory: ${this.imagesDir}`);
    }
  }

  /**
   * Clean up browser instance
   */
  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Serve image file. Caching is handled by the browser via Cache-Control
   * headers set in the controller (public, max-age=31536000 for track images).
   */
  async serveImage(
    imagePath: string,
    isDefault: boolean = false,
  ): Promise<Buffer> {
    try {
      let fullPath = imagePath;
      if (!isDefault) {
        fullPath = imagePath.includes(this.imagesDir)
          ? imagePath
          : path.join(this.imagesDir, imagePath);
      }
      const imageBuffer = await fs.readFile(fullPath);
      return imageBuffer;
    } catch (error) {
      this.logger.error(`Error serving image ${imagePath}:`, error);
      throw new NotFoundException(`Image not found: ${imagePath}`);
    }
  }

  async addImageSearchRecord(
    trackId: string,
    albumArt: SimpleAlbumArt,
  ): Promise<ImageSearchResult> {
    try {
      const imageUrl =
        albumArt.imageUrl || path.join(this.imagesDir, albumArt.imagePath);
      const imageSearch = await this.prisma.imageSearch.create({
        data: {
          trackId,
          searchUrl: imageUrl,
          status: ImageSearchStatus.COMPLETED,
          imagePath: albumArt.imagePath,
          imageUrl: imageUrl,
          source: albumArt.source,
        },
      });

      return {
        id: imageSearch.id,
        trackId: imageSearch.trackId,
        searchUrl: imageSearch.searchUrl,
        imagePath: imageSearch.imagePath || undefined,
        imageUrl: imageSearch.imageUrl || undefined,
        status: imageSearch.status.toLowerCase() as
          | 'pending'
          | 'completed'
          | 'failed',
        createdAt: imageSearch.createdAt,
        updatedAt: imageSearch.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error creating image search record for track ${trackId}:`,
        error,
      );
      throw error;
    }
  }
}
