import { Client } from '@elastic/elasticsearch';
import { Injectable } from '@nestjs/common';
import { ITrackIndexerPort } from 'src/application/ports/queries/ITrackIndexerPort';
import { extractModelId, MusicTrackId } from 'src/kernel/ids';
import { MusicTrack } from 'src/kernel/types';
import { ElasticsearchClient } from './elasticsearch.client';
import { toElasticsearchTrackDocument } from './mappers/track-index-document.mapper';
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
  async indexTrack(document: MusicTrack): Promise<void> {
    try {
      await this.elasticsearchClient.index({
        index: 'music_tracks',
        id: document.id,
        body: toElasticsearchTrackDocument(document),
      });
    } catch (error) {
      throw error;
    }
  }

  async indexTracks(documents: MusicTrack[]): Promise<void> {
    try {
      const body = documents.flatMap((track) => [
        { index: { _index: 'music_tracks', _id: track.id } },
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
}
