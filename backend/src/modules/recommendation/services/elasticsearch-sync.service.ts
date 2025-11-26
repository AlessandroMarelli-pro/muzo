import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '../../../shared/services/elasticsearch.service';
import { PrismaService } from '../../../shared/services/prisma.service';
import { RecommendationService } from './recommendation.service';

@Injectable()
export class ElasticsearchSyncService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly recommendationService: RecommendationService,
  ) {}

  async onModuleInit() {
    // Initialize Elasticsearch index on startup
    try {
      await this.elasticsearchService.ensureIndexExists();
      this.logger.log('Elasticsearch index initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Elasticsearch index:', error);
    }
  }

  async syncTrackOnUpdate(trackId: string): Promise<void> {
    try {
      await this.recommendationService.syncTrackToElasticsearch(trackId);
      this.logger.log(`Track ${trackId} synced to Elasticsearch after update`);
    } catch (error) {
      this.logger.error(
        `Error syncing track ${trackId} to Elasticsearch:`,
        error,
      );
    }
  }

  async syncTrackOnCreate(trackId: string): Promise<void> {
    try {
      await this.recommendationService.syncTrackToElasticsearch(trackId);
      this.logger.log(
        `Track ${trackId} synced to Elasticsearch after creation`,
      );
    } catch (error) {
      this.logger.error(
        `Error syncing track ${trackId} to Elasticsearch:`,
        error,
      );
    }
  }

  async syncTrackOnDelete(trackId: string): Promise<void> {
    try {
      await this.elasticsearchService.deleteTrack(trackId);
      this.logger.log(`Track ${trackId} deleted from Elasticsearch`);
    } catch (error) {
      this.logger.error(
        `Error deleting track ${trackId} from Elasticsearch:`,
        error,
      );
    }
  }

  async syncAllTracks(): Promise<void> {
    try {
      await this.recommendationService.syncAllTracksToElasticsearch();
      this.logger.log('All tracks synced to Elasticsearch');
    } catch (error) {
      this.logger.error('Error syncing all tracks to Elasticsearch:', error);
      throw error;
    }
  }

  async syncTracksByLibrary(libraryId: string): Promise<void> {
    try {
      const tracks = await this.prisma.musicTrack.findMany({
        where: { libraryId },
        include: {
          audioFingerprint: true,
          aiAnalysisResult: true,
          library: true,
          imageSearches: true,
        },
      });

      const elasticsearchDocs = tracks.map((track) =>
        this.recommendationService.mapTrackToElasticsearchDocument(track),
      );

      await this.elasticsearchService.bulkIndexTracks(elasticsearchDocs);

      this.logger.log(
        `Synced ${tracks.length} tracks from library ${libraryId} to Elasticsearch`,
      );
    } catch (error) {
      this.logger.error(
        `Error syncing tracks from library ${libraryId} to Elasticsearch:`,
        error,
      );
      throw error;
    }
  }

  async getElasticsearchStats(): Promise<any> {
    try {
      const response = await this.elasticsearchService.searchTracks({
        query: { match_all: {} },
        size: 0,
      });

      return {
        totalTracks: response.hits.total,
        indexName: 'music_tracks',
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting Elasticsearch stats:', error);
      throw error;
    }
  }
}
