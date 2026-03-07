import { Client } from '@elastic/elasticsearch';
import { Inject, Injectable } from '@nestjs/common';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { ITrackIndexerPort } from 'src/application/ports/queries/ITrackIndexerPort';
import { extractModelId, MusicTrackId } from 'src/kernel/ids';
import { MusicTrack } from 'src/kernel/types';
import { ElasticsearchClient } from './elasticsearch.client';
import { toElasticsearchTrackDocument } from './mappers/track-index-document.mapper';
import { trackIndexMapping } from './mappings/track-index.mapping';

@Injectable()
export class ElasticsearchTrackIndexerAdapter implements ITrackIndexerPort {
  private elasticsearchClient: Client;

  constructor(
    private readonly client: ElasticsearchClient,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {
    this.elasticsearchClient = this.client.getClient();
  }

  async createIndex(): Promise<void> {
    await this.elasticsearchClient.indices.create({
      index: 'music_tracks',
      mappings: trackIndexMapping.mappings,
    });
  }
  async indexTrack(document: MusicTrack): Promise<void> {
    try {
      const response = await this.elasticsearchClient.index({
        index: 'music_tracks',
        id: document.id,
        body: toElasticsearchTrackDocument(document),
      });
      this.logger.debug('Indexed track to elasticsearch', {
        trackId: document.id,
        response,
      });
    } catch (error) {
      this.logger.error('Failed to index track to elasticsearch', {
        error,
        trackId: document.id,
      });
      throw error;
    }
  }

  async indexTracks(documents: MusicTrack[]): Promise<void> {
    const body = documents.flatMap((track) => [
      { index: { _index: 'music_tracks', _id: track.id } },
      toElasticsearchTrackDocument(track),
    ]);

    await this.elasticsearchClient.bulk({
      body,
    });
  }

  async deleteTrack(trackId: MusicTrackId): Promise<void> {
    await this.elasticsearchClient.delete({
      index: 'music_tracks',
      id: trackId,
    });
  }

  async deleteTracks(trackIds: MusicTrackId[]): Promise<void> {
    await this.elasticsearchClient.bulk({
      index: 'music_tracks',
      body: trackIds.map((id) => ({
        delete: { _id: extractModelId(id).dbId },
      })),
    });
  }

  async recreateIndex(): Promise<void> {
    const indexExists = await this.elasticsearchClient.indices.exists({
      index: 'music_tracks',
    });
    if (indexExists) {
      await this.elasticsearchClient.indices.delete({
        index: 'music_tracks',
      });
    }
    await this.createIndex();
  }

  async updateIndexMapping(): Promise<void> {
    await this.elasticsearchClient.indices.putMapping({
      index: 'music_tracks',
      body: trackIndexMapping,
    });
  }
}
