import { Inject, Injectable } from '@nestjs/common';
import { ITrackIndexerPort } from 'src/application/ports/queries/ITrackIndexerPort';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { extractModelId, MusicTrackId } from 'src/kernel/ids';
import { MusicTrack } from 'src/kernel/types';
import { Prisma } from '@prisma/client';

const EMBEDDING_DIM = 1280;

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

function isValidEmbeddingVector(vector: number[] | undefined): vector is number[] {
  return (
    Array.isArray(vector) &&
    vector.length === EMBEDDING_DIM &&
    vector.every((value) => Number.isFinite(value))
  );
}

/**
 * Postgres replacement for ElasticsearchTrackIndexerAdapter. Postgres *is*
 * the system of record here, so there's no separate index to build or
 * recreate -- `indexTrack(s)` just keeps `AudioFingerprint.embeddingVector`
 * in sync with the analysis-time embedding, and every other
 * ITrackIndexerPort method is a no-op: row deletion already cascades via the
 * `AudioFingerprint.track` relation's `onDelete: Cascade`, and there is no ES
 * index/mapping to create or recreate.
 */
@Injectable()
export class PostgresTrackIndexerAdapter implements ITrackIndexerPort {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async createIndex(): Promise<void> {
    // No-op: Postgres is the system of record, not a secondary index.
  }

  async indexTrack(document: MusicTrack): Promise<void> {
    await this.syncEmbedding(document);
  }

  async indexTracks(documents: MusicTrack[]): Promise<void> {
    for (const document of documents) {
      await this.syncEmbedding(document);
    }
  }

  private async syncEmbedding(document: MusicTrack): Promise<void> {
    const embedding = document.features?.embedding;
    if (!isValidEmbeddingVector(embedding)) {
      return;
    }
    const { dbId } = extractModelId(document.id);
    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE "audio_fingerprints" SET "embeddingVector" = ${toVectorLiteral(embedding)}::vector WHERE "trackId" = ${dbId}`,
    );
  }

  async deleteTrack(_trackId: MusicTrackId): Promise<void> {
    // No-op: AudioFingerprint rows cascade-delete with their MusicTrack.
  }

  async deleteTracks(_trackIds: MusicTrackId[]): Promise<void> {
    // No-op: AudioFingerprint rows cascade-delete with their MusicTrack.
  }

  async recreateIndex(): Promise<void> {
    // No-op: no secondary index to recreate.
  }

  async updateIndexMapping(): Promise<void> {
    // No-op: no secondary index mapping to update.
  }
}
