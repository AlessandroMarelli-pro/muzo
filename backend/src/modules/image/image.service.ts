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
   * Get image for a specific track
   */
  async getImageForTrack(trackId: string): Promise<ImageSearchResult | null> {
    try {
      const track = await this.prisma.musicTrack.findUnique({
        where: { id: trackId },
        select: {
          id: true,
          originalArtist: true,
          originalAlbum: true,
          aiArtist: true,
          aiAlbum: true,
          userArtist: true,
          userAlbum: true,
        },
      });

      if (!track) {
        throw new NotFoundException(`Track with ID ${trackId} not found`);
      }

      // Check if image already exists
      const existingImage = await this.findExistingImage(trackId);
      if (existingImage) {
        return existingImage;
      }

      // Create new image search
      return null;
    } catch (error) {
      this.logger.error(`Error getting image for track ${trackId}:`, error);
      throw error;
    }
  }

  /**
   * Get image search status
   */
  async getImageSearchStatus(
    searchId: string,
  ): Promise<ImageSearchResult | null> {
    try {
      const imageSearch = await this.prisma.imageSearch.findUnique({
        where: { id: searchId },
      });

      if (!imageSearch) {
        return null;
      }

      return {
        id: imageSearch.id,
        trackId: imageSearch.trackId,
        searchUrl: imageSearch.searchUrl,
        status: imageSearch.status.toLowerCase() as
          | 'pending'
          | 'completed'
          | 'failed',
        imagePath: imageSearch.imagePath || undefined,
        imageUrl: imageSearch.imageUrl || undefined,
        error: imageSearch.error || undefined,
        createdAt: imageSearch.createdAt,
        updatedAt: imageSearch.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error getting image search status for ${searchId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Serve image file
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

  /**
   * Get image URL for a track
   */
  async getImageUrl(trackId: string): Promise<string | null> {
    try {
      const imageSearch = await this.prisma.imageSearch.findFirst({
        where: {
          trackId,
          status: ImageSearchStatus.COMPLETED,
          imageUrl: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return imageSearch?.imageUrl || null;
    } catch (error) {
      this.logger.error(`Error getting image URL for track ${trackId}:`, error);
      return null;
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
  private async findExistingImage(
    trackId: string,
  ): Promise<ImageSearchResult | null> {
    try {
      const imageSearch = await this.prisma.imageSearch.findFirst({
        where: {
          trackId,
          status: ImageSearchStatus.COMPLETED,
          imagePath: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (!imageSearch) {
        return null;
      }

      // Verify the file still exists on disk
      try {
        const fullPath = path.join(this.imagesDir, imageSearch.imagePath!);
        await fs.access(fullPath);

        return {
          id: imageSearch.id,
          trackId: imageSearch.trackId,
          searchUrl: imageSearch.searchUrl,
          status: imageSearch.status.toLowerCase() as
            | 'pending'
            | 'completed'
            | 'failed',
          imagePath: imageSearch.imagePath || undefined,
          imageUrl: imageSearch.imageUrl || undefined,
          createdAt: imageSearch.createdAt,
          updatedAt: imageSearch.updatedAt,
        };
      } catch {
        // File doesn't exist, mark as failed and return null
        await this.prisma.imageSearch.update({
          where: { id: imageSearch.id },
          data: {
            status: ImageSearchStatus.FAILED,
            error: 'Image file not found on disk',
          },
        });
        return null;
      }
    } catch (error) {
      this.logger.error(
        `Error finding existing image for track ${trackId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get all image searches for a track
   */
  async getImageSearchesForTrack(
    trackId: string,
  ): Promise<ImageSearchResult[]> {
    try {
      const imageSearches = await this.prisma.imageSearch.findMany({
        where: { trackId },
        orderBy: { createdAt: 'desc' },
      });

      return imageSearches.map((search) => ({
        id: search.id,
        trackId: search.trackId,
        searchUrl: search.searchUrl,
        status: search.status.toLowerCase() as
          | 'pending'
          | 'completed'
          | 'failed',
        imagePath: search.imagePath || undefined,
        imageUrl: search.imageUrl || undefined,
        error: search.error || undefined,
        createdAt: search.createdAt,
        updatedAt: search.updatedAt,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting image searches for track ${trackId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Delete image for a track
   */
  async deleteImageForTrack(trackId: string): Promise<boolean> {
    try {
      // Find all completed image searches for this track
      const imageSearches = await this.prisma.imageSearch.findMany({
        where: {
          trackId,
          status: ImageSearchStatus.COMPLETED,
          imagePath: { not: null },
        },
      });

      // Delete image files from disk
      for (const search of imageSearches) {
        if (search.imagePath) {
          try {
            const fullPath = path.join(this.imagesDir, search.imagePath);
            await fs.unlink(fullPath);
            this.logger.log(`Deleted image file: ${search.imagePath}`);
          } catch (error) {
            this.logger.warn(
              `Could not delete image file ${search.imagePath}:`,
              error,
            );
          }
        }
      }

      // Mark all searches as failed
      await this.prisma.imageSearch.updateMany({
        where: { trackId },
        data: {
          status: ImageSearchStatus.FAILED,
          error: 'Image deleted by user',
        },
      });

      this.logger.log(`Deleted images for track ${trackId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting images for track ${trackId}:`, error);
      return false;
    }
  }
}
