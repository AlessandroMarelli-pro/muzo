import { Queue as PrismaQueue } from '@prisma/client';
import type { PrismaMusicTrackWithRelations } from 'src/adapters/persistence/repositories/music-track/music-track.mapper';
import type { QueueItemWithTrack } from 'src/application/ports/repositories/IQueueRepository';
import { QueueItem } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDomainModel } from '../domain';
import { toDomain as toDomainMusicTrack } from '../music-track/music-track.mapper';

export type PrismaQueueWithTrack = PrismaQueue & {
  track?: PrismaMusicTrackWithRelations | null;
};

function normalizeUpdatedAt(row: PrismaQueue): Date {
  return row.updatedAt ?? row.createdAt;
}

export function toDomain(row: PrismaQueue): QueueItem {
  return {
    id: models.queueItem.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: normalizeUpdatedAt(row),
      updatedById: row.updatedById ?? null,
    }),
    trackId: models.musicTrack.id(row.trackId),
    position: row.position,
  };
}

export function toDomainWithTrack(
  row: PrismaQueueWithTrack,
): QueueItemWithTrack {
  const item = toDomain(row);
  const track = row.track
    ? toDomainMusicTrack(row.track as PrismaMusicTrackWithRelations)
    : null;
  return { ...item, track };
}

export function toPrismaCreate(
  trackIdDb: string,
  position: number,
  createdById: string,
) {
  return {
    trackId: trackIdDb,
    position,
    createdById,
  };
}
