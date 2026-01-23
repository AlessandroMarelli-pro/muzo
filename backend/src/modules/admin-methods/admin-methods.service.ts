import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { ElasticsearchService } from '../../shared/services/elasticsearch.service';
import { PrismaService } from '../../shared/services/prisma.service';
import { RecommendationService } from '../recommendation/services/recommendation.service';

@Injectable()
export class AdminMethodsService {
  private readonly logger = new Logger(AdminMethodsService.name);

  constructor(private readonly prisma: PrismaService, private readonly elasticsearchService: ElasticsearchService, private readonly recommendationService: RecommendationService) { }

  /**
   * This method will get all tracks from elastic search and ensure they are in the database
   * If not, remove them from elastic search 
   * Recreate the index if needed
   * Resync all track to elastic search at the end
   */
  async syncElasticsearch(): Promise<void> {
    try {
      const tracks = await this.elasticsearchService.searchTracks({
        query: { match_all: {} },
        size: 0,
      });
      for (const track of tracks.hits.hits) {
        const trackData = track._source;
        const trackInDatabase = await this.prisma.musicTrack.findUnique({
          where: { id: trackData.id },
        });
        if (!trackInDatabase) {
          await this.elasticsearchService.deleteTrack(trackData.id);
        }
      }
      await this.elasticsearchService.recreateIndex();
      await this.recommendationService.syncAllTracksToElasticsearch();
    } catch (error) {
      this.logger.error('Error syncing elasticsearch:', error);
      throw error;
    }
  }
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
      for (const track of tracks) {
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
