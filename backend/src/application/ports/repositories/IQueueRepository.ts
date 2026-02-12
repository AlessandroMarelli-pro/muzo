import { Maybe } from 'src/kernel/common';
import { MusicTrackId } from 'src/kernel/ids';
import { MusicTrack, QueueItem } from 'src/kernel/types/model-types';
import { createToken } from '../../utils/create-token';

export type QueueItemWithTrack = QueueItem & {
  track: Maybe<MusicTrack>;
};

export type RemoveTrackFromQueueResult = {
  success: boolean;
  trackId: MusicTrackId;
  artist: Maybe<string>;
  title: Maybe<string>;
};

export type UpdateQueuePositionInput = {
  trackId: MusicTrackId;
  position: number;
};

export const QUEUE_REPOSITORY =
  createToken<IQueueRepository>('QUEUE_REPOSITORY');

export interface IQueueRepository {
  getQueue(): Promise<QueueItemWithTrack[]>;
  addTrack(trackId: MusicTrackId): Promise<QueueItemWithTrack>;
  addTracks(trackIds: MusicTrackId[]): Promise<QueueItemWithTrack[]>;
  removeTrack(trackId: MusicTrackId): Promise<RemoveTrackFromQueueResult>;
  updatePositions(
    positions: UpdateQueuePositionInput[],
  ): Promise<QueueItemWithTrack[]>;
  resetQueue(): Promise<boolean>;
  findByTrackId(trackId: MusicTrackId): Promise<QueueItem | null>;
  getLastPosition(): Promise<number | null>;
}
