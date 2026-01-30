// adapters/graphql/utils/parse-id.ts
import { BadRequestException } from '@nestjs/common';
import type { PlaylistId, UserId } from 'src/clean-arch/kernel/ids';
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
