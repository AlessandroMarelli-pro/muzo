import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { PrismaService } from '../../shared/services/prisma.service';

@Injectable()
export class AdminMethodsService {
  private readonly logger = new Logger(AdminMethodsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Updates the fileCreatedAt field for all tracks by reading the actual file modification time
   * from the filesystem. This method iterates over all tracks and sets fileCreatedAt to the
   * file's last modified timestamp (stats.mtime).
   *
   * @returns Object containing statistics about the update operation
   */
  async updateTrackFileCreatedAt(): Promise<{
    totalTracks: number;
    updatedTracks: number;
    failedTracks: number;
    errors: Array<{ trackId: string; filePath: string; error: string }>;
  }> {
    this.logger.log('Starting updateTrackFileCreatedAt operation');

    const result = {
      totalTracks: 0,
      updatedTracks: 0,
      failedTracks: 0,
      errors: [] as Array<{ trackId: string; filePath: string; error: string }>,
    };

    try {
      // Get all tracks from the database
      const tracks = await this.prisma.musicTrack.findMany({
        select: {
          id: true,
          filePath: true,
        },
      });

      result.totalTracks = tracks.length;
      this.logger.log(`Found ${tracks.length} tracks to process`);

      // Process each track
      for (const track of [tracks[0]]) {
        try {
          // Check if file exists
          if (!fs.existsSync(track.filePath)) {
            result.failedTracks++;
            result.errors.push({
              trackId: track.id,
              filePath: track.filePath,
              error: 'File does not exist',
            });
            this.logger.warn(
              `File not found for track ${track.id}: ${track.filePath}`,
            );
            continue;
          }

          // Get file stats to read the modification time
          const stats = fs.statSync(track.filePath);
          const fileCreatedAt = stats.birthtime;
          console.log('fileCreatedAt', fileCreatedAt);
          // Update the track's fileCreatedAt field
          await this.prisma.musicTrack.update({
            where: { id: track.id },
            data: { fileCreatedAt },
          });

          result.updatedTracks++;
        } catch (error) {
          result.failedTracks++;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          result.errors.push({
            trackId: track.id,
            filePath: track.filePath,
            error: errorMessage,
          });
          this.logger.error(
            `Failed to update track ${track.id} (${track.filePath}): ${errorMessage}`,
          );
        }
      }

      this.logger.log(
        `Completed updateTrackFileCreatedAt: ${result.updatedTracks} updated, ${result.failedTracks} failed out of ${result.totalTracks} total`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error in updateTrackFileCreatedAt: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
