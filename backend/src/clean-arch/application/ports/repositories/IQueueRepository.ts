import { Maybe } from 'src/clean-arch/kernel/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { MusicTrack, QueueItem } from 'src/clean-arch/kernel/types/model-types';

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

export const QUEUE_REPOSITORY = Symbol('IQueueRepository');

export interface IQueueRepository {
  getQueue(): Promise<QueueItemWithTrack[]>;
  addTrack(trackId: MusicTrackId): Promise<QueueItemWithTrack>;
  addTracks(trackIds: MusicTrackId[]): Promise<QueueItemWithTrack[]>;
  removeTrack(trackId: MusicTrackId): Promise<RemoveTrackFromQueueResult>;
  updatePositions(
    positions: UpdateQueuePositionInput[],
  ): Promise<QueueItemWithTrack[]>;
  resetQueue(): Promise<void>;
  findByTrackId(trackId: MusicTrackId): Promise<QueueItem | null>;
  getLastPosition(): Promise<number | null>;
}
