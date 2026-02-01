import {
  Playlist as PrismaPlaylist,
  PlaylistSorting as PrismaPlaylistSorting,
  PlaylistTrack as PrismaPlaylistTrack,
} from '@prisma/client';
import { PlaylistTrackWithTrackDetailAndSorting } from 'src/clean-arch/application/dtos/PlaylistWithTrackDetailsAndSorting';
import { PlaylistUpdateData } from 'src/clean-arch/application/ports/repositories/IPlaylistRepository';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { now, user } from 'src/clean-arch/kernel/types/context';
import {
  Playlist,
  PlaylistSorting,
  PlaylistTrack,
} from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
import { toDbModel } from '../db';
import { toDomainModel } from '../domain';
import { toDomain as toDomainMusicTrack } from '../music-track/music-track.mapper';
import { toDomain as toDomainSorting } from '../playlist-sorting/playlist-sorting.mapper';
import {
  PrismaPlaylistTrackWithTrackDetail,
  toDomain as toDomainPlaylistTrack,
} from '../playlist-track/playlist-track.mapper';

export type PrismaPlaylistWithSorting = PrismaPlaylist & {
  sorting: PrismaPlaylistSorting;
};
export type PrismaPlaylistWithTracksAndSorting = PrismaPlaylistWithSorting & {
  tracks: PrismaPlaylistTrack[];
};

export type PrismaPlaylistWithTracksWithRelationsAndSorting =
  PrismaPlaylistWithSorting & {
    tracks: PrismaPlaylistTrackWithTrackDetail[];
  };

export type ToDomain = (row: PrismaPlaylist) => Playlist;

export type ToDomainWithSorting = (
  row: PrismaPlaylistWithSorting,
) => Playlist & { sorting: PlaylistSorting };

export type ToDomainWithTracksAndSorting = (
  row: PrismaPlaylistWithTracksAndSorting,
) => Playlist & {
  sorting: PlaylistSorting;
  tracks: PlaylistTrack[];
};

export type ToDomainWithTracksWithRelationsAndSorting = (
  row: PrismaPlaylistWithTracksWithRelationsAndSorting,
) => PlaylistTrackWithTrackDetailAndSorting;

export const toDomainWithSorting: ToDomainWithSorting = (row) => {
  return {
    ...toDomain(row),
    sorting: row.sorting ? toDomainSorting(row.sorting) : null,
  };
};

export const toDomainWithTracksAndSorting: ToDomainWithTracksAndSorting = (
  row,
) => {
  return {
    ...toDomainWithSorting(row),
    tracks: row.tracks.map((track) => toDomainPlaylistTrack(track)),
  };
};

export const toDomainWithTracksWithRelationsAndSorting: ToDomainWithTracksWithRelationsAndSorting =
  (row) => {
    return {
      ...toDomainWithSorting(row),
      tracks: row.tracks.map((track) => ({
        ...toDomainPlaylistTrack(track),
        track: toDomainMusicTrack(track.track),
      })),
    };
  };
export const toDomain: ToDomain = (row) => {
  return {
    id: models.playlist.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
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

export type ToPrismaUpdateData = (
  data: PlaylistUpdateData,
) => Partial<PrismaPlaylist>;

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
