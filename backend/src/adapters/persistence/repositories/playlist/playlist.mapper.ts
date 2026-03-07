import {
  Playlist as PrismaPlaylist,
  PlaylistSorting as PrismaPlaylistSorting,
  PlaylistTrack as PrismaPlaylistTrack,
} from '@prisma/client';
import { PlaylistTrackWithTrackDetailAndSorting } from 'src/application/ports/dtos/PlaylistWithTrackDetailsAndSorting';
import { PlaylistUpdateData } from 'src/application/ports/repositories/IPlaylistRepository';
import { Maybe, MaybeUndefined } from 'src/kernel/common';
import { extractModelId } from 'src/kernel/ids/factory';
import { now, user } from 'src/kernel/types/context';
import { Playlist, PlaylistSorting, PlaylistTrack } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDbModel } from '../db';
import { toDomainModel } from '../domain';
import { toDomain as toDomainMusicTrack } from '../music-track/music-track.mapper';
import { toDomain as toDomainSorting } from '../playlist-sorting/playlist-sorting.mapper';
import {
  PrismaPlaylistTrackWithTrackDetail,
  toDomain as toDomainPlaylistTrack,
} from '../playlist-track/playlist-track.mapper';

export type PrismaPlaylistWithSorting = PrismaPlaylist & {
  sorting: Maybe<PrismaPlaylistSorting>;
};
export type PrismaPlaylistWithTracksAndSorting = PrismaPlaylistWithSorting & {
  tracks: Maybe<PrismaPlaylistTrack[]>;
};

export type PrismaPlaylistWithTracksWithRelationsAndSorting = PrismaPlaylistWithSorting & {
  tracks: Maybe<PrismaPlaylistTrackWithTrackDetail[]>;
};

export type ToDomain = (row: PrismaPlaylist) => Playlist;

export type ToDomainWithSorting = (
  row: PrismaPlaylistWithSorting,
) => Playlist & { sorting: MaybeUndefined<PlaylistSorting> };

export type ToDomainWithTracksAndSorting = (row: PrismaPlaylistWithTracksAndSorting) => Playlist & {
  sorting: MaybeUndefined<PlaylistSorting>;
  tracks: MaybeUndefined<PlaylistTrack[]>;
};

export type ToDomainWithTracksWithRelationsAndSorting = (
  row: PrismaPlaylistWithTracksWithRelationsAndSorting,
) => PlaylistTrackWithTrackDetailAndSorting;

export const toDomainWithSorting: ToDomainWithSorting = (row) => {
  return {
    ...toDomain(row),
    sorting: row.sorting ? toDomainSorting(row.sorting) : undefined,
  };
};

export const toDomainWithTracksAndSorting: ToDomainWithTracksAndSorting = (row) => {
  return {
    ...toDomainWithSorting(row),
    tracks: row.tracks?.map((track) => toDomainPlaylistTrack(track)) ?? [],
  };
};

export const toDomainWithTracksWithRelationsAndSorting: ToDomainWithTracksWithRelationsAndSorting =
  (row) => {
    return {
      ...(toDomainWithSorting(row) as Playlist & { sorting: PlaylistSorting }),
      tracks:
        row.tracks?.map((track) => ({
          ...toDomainPlaylistTrack(track),
          track: toDomainMusicTrack(track.track),
        })) ?? [],
    };
  };
export const toDomain: ToDomain = (row) => {
  return {
    id: models.playlist.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt ?? undefined,
      updatedById: row.updatedById ?? undefined,
    }),
    name: row.name,
    description: row.description ?? null,
    isPublic: row.isPublic,
    isFavorite: row.isFavorite,
  };
};

export type ToPrisma = (domainModel: Playlist) => PrismaPlaylist;

export const toPrisma: ToPrisma = (domainModel) => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    userId: extractModelId(domainModel.createdById).dbId,
    name: domainModel.name,
    description: domainModel.description,
    isPublic: domainModel.isPublic,
    isFavorite: domainModel.isFavorite,
  };
};

export type ToPrismaUpdateData = (data: PlaylistUpdateData) => Partial<PrismaPlaylist>;

export const toPrismaUpdateData: ToPrismaUpdateData = (data) => {
  const result: Partial<PrismaPlaylist> = {
    updatedAt: now(),
    updatedById: extractModelId(user().id).dbId,
  };
  if (data.name !== undefined) result.name = data.name;
  if (data.description !== undefined) result.description = data.description;
  if (data.isPublic !== undefined) result.isPublic = data.isPublic;
  return result;
};
