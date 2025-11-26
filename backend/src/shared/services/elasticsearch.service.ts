import { Client } from '@elastic/elasticsearch';
import { MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchMusicTrackDocument } from 'src/models/music-track.model';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  public readonly client: Client;

  private readonly mapping: { mappings: MappingTypeMapping } = {
    mappings: {
      properties: {
        // MusicTrack core fields
        id: { type: 'keyword' },
        file_path: { type: 'keyword' },
        file_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        file_size: { type: 'long' },
        duration: { type: 'float' },
        format: { type: 'keyword' },
        bitrate: { type: 'integer' },
        sample_rate: { type: 'integer' },

        // Original Metadata
        original_title: {
          type: 'text',
          analyzer: 'standard',
          fields: { keyword: { type: 'keyword' } },
        },
        original_artist: {
          type: 'text',
          analyzer: 'standard',
          fields: { keyword: { type: 'keyword' } },
        },
        original_album: {
          type: 'text',
          analyzer: 'standard',
          fields: { keyword: { type: 'keyword' } },
        },
        original_genre: { type: 'keyword' },
        original_year: { type: 'integer' },
        original_albumartist: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },
        original_date: { type: 'date' },
        original_bpm: { type: 'integer' },
        original_track_number: { type: 'integer' },
        original_disc_number: { type: 'keyword' },
        original_comment: { type: 'text' },
        original_composer: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },
        original_copyright: { type: 'text' },

        // AI-Generated Metadata
        ai_title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        ai_artist: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        ai_album: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        ai_genre: { type: 'keyword', index: true },
        ai_confidence: { type: 'float' },
        ai_subgenre: { type: 'keyword', index: true },
        ai_subgenre_confidence: { type: 'float' },

        // User Modifications
        user_title: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },
        user_artist: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },
        user_album: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },
        user_genre: { type: 'keyword' },
        user_tags: { type: 'keyword' },

        // Listening Data
        listening_count: { type: 'integer' },
        last_played_at: { type: 'date' },
        is_favorite: { type: 'boolean', index: true },

        // Analysis Status
        analysis_status: { type: 'keyword' },
        analysis_started_at: { type: 'date' },
        analysis_completed_at: { type: 'date' },
        analysis_error: { type: 'text' },
        has_musicbrainz: { type: 'boolean' },
        has_discogs: { type: 'boolean' },

        // Library information
        library_id: { type: 'keyword' },
        library_name: { type: 'keyword' },

        // Timestamps
        created_at: { type: 'date' },
        updated_at: { type: 'date' },

        // AudioFingerprint fields
        audio_fingerprint: {
          properties: {
            // MFCC - stored as array
            mfcc: {
              type: 'dense_vector',
              dims: 13,
              similarity: 'cosine',
              index: true,
            },

            // Spectral Features - stored as nested objects with statistics
            spectral_centroid: {
              properties: {
                mean: { type: 'float' },
                std: { type: 'float' },
                median: { type: 'float' },
                min: { type: 'float' },
                max: { type: 'float' },
                p25: { type: 'float' },
                p75: { type: 'float' },
              },
            },
            spectral_rolloff: {
              properties: {
                mean: { type: 'float' },
                std: { type: 'float' },
                median: { type: 'float' },
                min: { type: 'float' },
                max: { type: 'float' },
                p25: { type: 'float' },
                p75: { type: 'float' },
              },
            },
            spectral_spread: {
              properties: {
                mean: { type: 'float' },
                std: { type: 'float' },
                median: { type: 'float' },
                min: { type: 'float' },
                max: { type: 'float' },
                p25: { type: 'float' },
                p75: { type: 'float' },
              },
            },
            spectral_bandwidth: {
              properties: {
                mean: { type: 'float' },
                std: { type: 'float' },
                median: { type: 'float' },
                min: { type: 'float' },
                max: { type: 'float' },
                p25: { type: 'float' },
                p75: { type: 'float' },
              },
            },
            spectral_flatness: {
              properties: {
                mean: { type: 'float' },
                std: { type: 'float' },
                median: { type: 'float' },
                min: { type: 'float' },
                max: { type: 'float' },
                p25: { type: 'float' },
                p75: { type: 'float' },
              },
            },
            spectral_contrast: {
              properties: {
                mean: { type: 'float' },
                std: { type: 'float' },
                median: { type: 'float' },
                min: { type: 'float' },
                max: { type: 'float' },
                p25: { type: 'float' },
                p75: { type: 'float' },
              },
            },

            // Chroma features - pitch class distribution (12 dimensions)
            chroma: {
              properties: {
                mean: {
                  type: 'dense_vector',
                  dims: 12,
                  similarity: 'cosine',
                  index: true,
                },
                std: {
                  type: 'dense_vector',
                  dims: 12,
                  similarity: 'cosine',
                  index: true,
                },
                max: {
                  type: 'dense_vector',
                  dims: 12,
                  similarity: 'cosine',
                  index: true,
                },
                overall_mean: { type: 'float' },
                overall_std: { type: 'float' },
                dominant_pitch: { type: 'integer' },
              },
            },

            // Tonnetz features - tonal centroid (6 dimensions)
            tonnetz: {
              properties: {
                mean: {
                  type: 'dense_vector',
                  dims: 6,
                  similarity: 'cosine',
                  index: true,
                },
                std: {
                  type: 'dense_vector',
                  dims: 6,
                  similarity: 'cosine',
                  index: true,
                },
                max: {
                  type: 'dense_vector',
                  dims: 6,
                  similarity: 'cosine',
                  index: true,
                },
                overall_mean: { type: 'float' },
                overall_std: { type: 'float' },
              },
            },

            // Zero Crossing Rate
            zero_crossing_rate: {
              properties: {
                mean: { type: 'float' },
                std: { type: 'float' },
                median: { type: 'float' },
                min: { type: 'float' },
                max: { type: 'float' },
                p25: { type: 'float' },
                p75: { type: 'float' },
              },
            },

            // RMS
            rms: {
              properties: {
                mean: { type: 'float' },
                std: { type: 'float' },
                median: { type: 'float' },
                min: { type: 'float' },
                max: { type: 'float' },
                p25: { type: 'float' },
                p75: { type: 'float' },
              },
            },

            // Musical Features
            tempo: { type: 'float', index: true },
            key: { type: 'keyword', index: true },
            camelot_key: { type: 'keyword', index: true },
            valence: { type: 'float', index: true },
            valence_mood: { type: 'keyword' },
            arousal: { type: 'float', index: true },
            arousal_mood: { type: 'keyword' },
            danceability: { type: 'float', index: true },
            danceability_feeling: { type: 'keyword' },
            rhythm_stability: { type: 'float' },
            bass_presence: { type: 'float' },
            tempo_regularity: { type: 'float' },
            tempo_appropriateness: { type: 'float' },
            energy_factor: { type: 'float' },
            syncopation: { type: 'float' },
            acousticness: { type: 'float', index: true },
            instrumentalness: { type: 'float', index: true },
            speechiness: { type: 'float', index: true },
            liveness: { type: 'float', index: true },
            mode_factor: { type: 'float' },
            mode_confidence: { type: 'float' },
            mode_weight: { type: 'float' },
            tempo_factor: { type: 'float' },
            brightness_factor: { type: 'float' },
            harmonic_factor: { type: 'float' },
            spectral_balance: { type: 'float' },
            beat_strength: { type: 'float' },

            // Hashes
            audio_hash: { type: 'keyword' },
            file_hash: { type: 'keyword' },

            // Energy
            energy_comment: { type: 'text' },
            energy_keywords: { type: 'keyword' },
            energy_by_band: { type: 'float' },
          },
        },

        // AIAnalysisResult fields
        ai_analysis: {
          properties: {
            model_version: { type: 'keyword' },
            genre_classification: { type: 'object', enabled: false },
            artist_suggestion: { type: 'object', enabled: false },
            album_suggestion: { type: 'object', enabled: false },
            processing_time: { type: 'float' },
            error_message: { type: 'text' },
          },
        },

        // Computed display fields for convenience (denormalized from relations)
        title: {
          type: 'text',
          analyzer: 'standard',
          fields: { keyword: { type: 'keyword' } },
        },
        artist: {
          type: 'text',
          analyzer: 'standard',
          fields: { keyword: { type: 'keyword' } },
        },
        album: {
          type: 'text',
          analyzer: 'standard',
          fields: { keyword: { type: 'keyword' } },
        },
        genre: { type: 'keyword', index: true },
        subgenre: { type: 'keyword', index: true },
      },
    },
  };
  constructor(private readonly configService: ConfigService) {
    const elasticsearchConfig = this.configService.get('elasticsearch');

    this.client = new Client({
      node: elasticsearchConfig.node,
      auth: elasticsearchConfig.auth,
      maxRetries: elasticsearchConfig.maxRetries,
      requestTimeout: elasticsearchConfig.requestTimeout,
      pingTimeout: elasticsearchConfig.pingTimeout,
    });
  }

  async onModuleInit() {
    try {
      await this.client.ping();
      this.logger.log('Successfully connected to Elasticsearch');
      await this.ensureIndexExists();
    } catch (error) {
      this.logger.error('Failed to connect to Elasticsearch:', error);
    }
  }

  async ensureIndexExists() {
    const indexName = 'music_tracks';

    try {
      const exists = await this.client.indices.exists({ index: indexName });

      if (!exists) {
        await this.createMusicTracksIndex();
        this.logger.log(`Created Elasticsearch index: ${indexName}`);
      } else {
        this.logger.log(`Elasticsearch index already exists: ${indexName}`);
        // Check if index needs updating
        await this.updateIndexMappingIfNeeded(indexName);
      }
    } catch (error) {
      this.logger.error('Error ensuring index exists:', error);
    }
  }

  /**
   * Update index mapping if new fields are added
   */
  async updateIndexMappingIfNeeded(indexName: string) {
    try {
      // Get current mapping
      const currentMapping = await this.client.indices.getMapping({
        index: indexName,
      });

      // Get new mapping from createMusicTracksIndex
      const newMapping = await this.getNewIndexMapping();

      // Compare mappings and update if needed
      const needsUpdate = this.compareMappings(
        currentMapping[indexName].mappings,
        newMapping.mappings,
      );

      if (needsUpdate) {
        this.logger.log('Updating index mapping...');
        await this.client.indices.putMapping({
          index: indexName,
          body: newMapping.mappings as any,
        });
        this.logger.log('Index mapping updated successfully');
      }
    } catch (error) {
      this.logger.error('Error updating index mapping:', error?.message);
    }
  }

  /**
   * Get the new mapping structure
   */
  private async getNewIndexMapping() {
    // Return the same mapping structure used in createMusicTracksIndex
    return this.mapping;
  }

  /**
   * Compare mappings to detect changes
   */
  private compareMappings(current: any, newMapping: any): boolean {
    // Simple comparison - you might want to make this more sophisticated
    return (
      JSON.stringify(current.properties) !==
      JSON.stringify(newMapping.properties)
    );
  }

  /**
   * Recreate the entire index (DESTRUCTIVE - will lose all data)
   * Use this when you need to change field types or make breaking changes
   */
  async recreateIndex(): Promise<void> {
    const indexName = 'music_tracks';

    try {
      this.logger.warn(
        'Recreating Elasticsearch index - this will delete all data!',
      );

      // Delete existing index
      const exists = await this.client.indices.exists({ index: indexName });
      if (exists) {
        await this.client.indices.delete({ index: indexName });
        this.logger.log('Deleted existing index');
      }

      // Create new index with updated mapping
      await this.createMusicTracksIndex();
      this.logger.log('Created new index with updated mapping');

      // Re-index all tracks
      await this.reindexAllTracks();
      this.logger.log('Re-indexed all tracks');
    } catch (error) {
      this.logger.error('Error recreating index:', error);
      throw error;
    }
  }

  /**
   * Re-index all tracks from the database
   */
  async reindexAllTracks(): Promise<void> {
    try {
      // This would need to be implemented to fetch all tracks from your database
      // and re-index them. You might want to call this from your sync service.
      this.logger.log('Re-indexing all tracks...');
      // Implementation depends on your data source
    } catch (error) {
      this.logger.error('Error re-indexing tracks:', error);
      throw error;
    }
  }

  /**
   * Force update index mapping (for non-breaking changes)
   */
  async forceUpdateMapping(): Promise<void> {
    const indexName = 'music_tracks';

    try {
      const newMapping = await this.getNewIndexMapping();

      await this.client.indices.putMapping({
        index: indexName,
        body: newMapping.mappings as any,
      });

      this.logger.log('Force updated index mapping');
    } catch (error) {
      this.logger.error('Error force updating mapping:', error);
      throw error;
    }
  }

  private async createMusicTracksIndex() {
    await this.client.indices.create({
      index: 'music_tracks',
      mappings: this.mapping.mappings,
    });
  }

  async indexTrack(trackData: any) {
    try {
      await this.client.index({
        index: 'music_tracks',
        id: trackData.id,
        body: trackData,
      });
    } catch (error) {
      this.logger.error('Error indexing track:', error);
      throw error;
    }
  }

  async bulkIndexTracks(tracksData: any[]) {
    try {
      const body = tracksData.flatMap((track) => [
        { index: { _index: 'music_tracks', _id: track.id } },
        track,
      ]);

      await this.client.bulk({ body });
    } catch (error) {
      this.logger.error('Error bulk indexing tracks:', error);
      throw error;
    }
  }

  async deleteTrack(trackId: string) {
    try {
      await this.client.delete({
        index: 'music_tracks',
        id: trackId,
      });
    } catch (error) {
      this.logger.error('Error deleting track from index:', error);
      throw error;
    }
  }

  async getTrack(trackId: string) {
    try {
      const response = await this.client.get({
        index: 'music_tracks',
        id: trackId,
      });
      return response;
    } catch (error) {
      this.logger.error('Error getting track from index:', error);
      throw error;
    }
  }

  async searchTracks(query: any) {
    try {
      const response =
        await this.client.search<ElasticsearchMusicTrackDocument>({
          index: 'music_tracks',
          body: query,
        });

      return response;
    } catch (error) {
      this.logger.error('Error searching tracks:', error);
      throw error;
    }
  }
}
