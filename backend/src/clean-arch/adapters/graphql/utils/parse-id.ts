// adapters/graphql/utils/parse-id.ts
import { BadRequestException } from '@nestjs/common';
import type {
  MusicTrackId,
  PlaylistId,
  PlaylistTrackId,
  QueueItemId,
  SavedFilterId,
  UserId,
} from 'src/clean-arch/kernel/ids';
import { models } from 'src/clean-arch/kernel/types/models';

function parseId<T extends string>(
  value: string,
  guard: (x: string) => x is T,
  entityName: string,
): T {
  if (!guard(value)) {
    throw new BadRequestException(`Invalid ${entityName} id`);
  }
  return value;
}

export const parsePlaylistId = (value: string): PlaylistId =>
  parseId(value, models.playlist.isId, 'Playlist');

export const parseUserId = (value: string): UserId =>
  parseId(value, models.user.isId, 'User');

export const parseMusicTrackId = (value: string): MusicTrackId =>
  parseId(value, models.musicTrack.isId, 'MusicTrack');

export const parsePlaylistTrackId = (value: string): PlaylistTrackId =>
  parseId(value, models.playlistTrack.isId, 'PlaylistTrack');

export const parseSavedFilterId = (value: string): SavedFilterId =>
  parseId(value, models.savedFilter.isId, 'SavedFilter');

export const parseQueueItemId = (value: string): QueueItemId =>
  parseId(value, models.queueItem.isId, 'QueueItem');
