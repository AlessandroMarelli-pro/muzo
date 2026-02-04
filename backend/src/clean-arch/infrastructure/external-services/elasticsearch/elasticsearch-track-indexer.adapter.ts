import { Client } from '@elastic/elasticsearch';
import { Injectable } from '@nestjs/common';
import { AudioFeatures } from 'src/clean-arch/application/ports/dtos/AudioFeatures';
import { TrackIndexDocument } from 'src/clean-arch/application/ports/dtos/TrackIndexDocument';
import { TrackIndexDocumentSimilarity } from 'src/clean-arch/application/ports/dtos/TrackIndexDocumentSimilarity';
import { ITrackIndexerPort } from 'src/clean-arch/application/ports/queries/ITrackIndexerPort';
import { extractModelId, MusicTrackId } from 'src/clean-arch/kernel/ids';
import { ElasticsearchClient } from './elasticsearch.client';
import { extractReasonsFromElasticsearch } from './helpers/extract-reason';
import {
  toElasticsearchTrackDocument,
  toTrackIndexDocument,
} from './mappers/track-index-document.mapper';
import { trackIndexMapping } from './mappings/track-index.mapping';

@Injectable()
export class ElasticsearchTrackIndexerAdapter implements ITrackIndexerPort {
  private elasticsearchClient: Client | null = null;
  constructor(private readonly client: ElasticsearchClient) {
    this.elasticsearchClient = this.client.getClient();
  }

  async createIndex(): Promise<void> {
    try {
      await this.elasticsearchClient.indices.create({
        index: 'music_tracks',
        mappings: trackIndexMapping.mappings,
      });
    } catch (error) {
      throw error;
    }
  }
  async indexTrack(document: TrackIndexDocument): Promise<void> {
    try {
      await this.elasticsearchClient.index({
        index: 'music_tracks',
        id: document.trackId,
        body: toElasticsearchTrackDocument(document),
      });
    } catch (error) {
      throw error;
    }
  }

  async indexTracks(documents: TrackIndexDocument[]): Promise<void> {
    try {
      const body = documents.flatMap((track) => [
        { index: { _index: 'music_tracks', _id: track.trackId } },
        toElasticsearchTrackDocument(track),
      ]);

      await this.elasticsearchClient.bulk({
        body,
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteTrack(trackId: MusicTrackId): Promise<void> {
    try {
      await this.elasticsearchClient.delete({
        index: 'music_tracks',
        id: trackId,
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteTracks(trackIds: MusicTrackId[]): Promise<void> {
    try {
      await this.elasticsearchClient.bulk({
        index: 'music_tracks',
        body: trackIds.map((id) => ({
          delete: { _id: extractModelId(id).dbId },
        })),
      });
    } catch (error) {
      throw error;
    }
  }

  async recreateIndex(): Promise<void> {
    try {
      await this.elasticsearchClient.indices.delete({
        index: 'music_tracks',
      });
      await this.createIndex();
    } catch (error) {
      throw error;
    }
  }

  async updateIndexMapping(): Promise<void> {
    try {
      await this.elasticsearchClient.indices.putMapping({
        index: 'music_tracks',
        body: trackIndexMapping,
      });
    } catch (error) {
      throw error;
    }
  }

  async searchTracks(
    playlistFeatures: AudioFeatures,
    query: any,
  ): Promise<TrackIndexDocumentSimilarity[]> {
    try {
      const response = await this.elasticsearchClient.search({
        index: 'music_tracks',
        body: query,
      });
      const hits = response.hits.hits;

      // Let Elasticsearch handle scoring - no normalization needed
      return hits.map((hit: any) => {
        return {
          track: toTrackIndexDocument(hit._source),
          similarity: hit._score, // Use raw Elasticsearch score directly
          reasons: extractReasonsFromElasticsearch(hit, playlistFeatures),
        };
      });
    } catch (error) {
      throw error;
    }
  }
}
