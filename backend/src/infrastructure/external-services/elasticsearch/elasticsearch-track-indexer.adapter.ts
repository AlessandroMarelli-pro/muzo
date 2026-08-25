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

  /**
   * Each track's document can be tens of KB once discogs_embedding (1280 floats) is
   * included -- a single bulk request for the whole library can exceed Elasticsearch's
   * default 100MB http.max_content_length, which fails at the transport layer with an
   * empty ResponseError (no message/meta.body) rather than a parseable ES error. Chunking
   * keeps each request comfortably under that limit.
   */
  private static readonly INDEX_CHUNK_SIZE = 500;

  async indexTracks(documents: MusicTrack[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    for (let i = 0; i < documents.length; i += ElasticsearchTrackIndexerAdapter.INDEX_CHUNK_SIZE) {
      const chunk = documents.slice(i, i + ElasticsearchTrackIndexerAdapter.INDEX_CHUNK_SIZE);
      await this.indexTrackChunk(chunk);
    }
  }

  private async indexTrackChunk(documents: MusicTrack[]): Promise<void> {
    const body = documents.flatMap((track) => [
      { index: { _index: 'music_tracks', _id: track.id } },
      toElasticsearchTrackDocument(track),
    ]);

    try {
      const response = await this.elasticsearchClient.bulk({
        body,
      });

      if (response.errors) {
        const allFailedItems = response.items
          .filter((item) => item.index?.error)
          .map((item) => ({ id: item.index?._id, error: item.index?.error }));
        // Cap logged items -- ES error `reason` strings can include a preview of the
        // invalid field value (e.g. a truncated vector), so a large failed batch could
        // still flood the console if every item were logged.
        const MAX_LOGGED_FAILURES = 10;
        this.logger.error('Bulk index to elasticsearch had per-document failures', {
          failedCount: allFailedItems.length,
          totalCount: documents.length,
          failedItems: allFailedItems.slice(0, MAX_LOGGED_FAILURES),
          truncated: allFailedItems.length > MAX_LOGGED_FAILURES,
        });
      }
    } catch (error) {
      this.logger.error('Bulk index to elasticsearch failed', {
        message: (error as Error)?.message,
        // meta.body carries the raw ES response (the actual rejection reason), which the
        // ResponseError's message/stack alone does not include.
        errorBody: (error as { meta?: { body?: unknown } })?.meta?.body,
        trackCount: documents.length,
      });
      throw error;
    }
  }

  async deleteTrack(trackId: MusicTrackId): Promise<void> {
    await this.elasticsearchClient.delete({
      index: 'music_tracks',
      id: trackId,
    });
  }

  async deleteTracks(trackIds: MusicTrackId[]): Promise<void> {
    if (trackIds.length === 0) {
      return;
    }

    try {
      await this.elasticsearchClient.bulk({
        index: 'music_tracks',
        body: trackIds.map((id) => ({
          delete: { _id: extractModelId(id).dbId },
        })),
      });
    } catch (error) {
      this.logger.error('Bulk delete from elasticsearch failed', {
        message: (error as Error)?.message,
        errorBody: (error as { meta?: { body?: unknown } })?.meta?.body,
        trackCount: trackIds.length,
      });
      throw error;
    }
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
