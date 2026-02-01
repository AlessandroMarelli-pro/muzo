import { Injectable } from '@nestjs/common';
import { PlaylistTrackWithTrackDetail } from 'src/clean-arch/application/dtos/PlaylistTrackWithDetail';
import {
  IPlaylistTrackRepository,
  PlaylistSortingOptions,
  PlaylistTrackPresence,
} from 'src/clean-arch/application/ports/repositories/IPlaylistTrackRepository';
import { PrismaService } from 'src/clean-arch/infrastructure/database/prisma.service';
import {
  extractModelId,
  MusicTrackId,
  PlaylistId,
} from 'src/clean-arch/kernel/ids';
import { models } from 'src/clean-arch/kernel/types';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import { PlaylistTrack } from 'src/clean-arch/kernel/types/model-types';
import { toDomain as toDomainMusicTrack } from '../music-track/music-track.mapper';
import { handlePrismaNotFound } from '../prisma-errors';
import { toDomain, toPrisma } from './playlist-track.mapper';
@Injectable()
export class PlaylistTrackRepository implements IPlaylistTrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(playlistTrack: PlaylistTrack): Promise<PlaylistTrack> {
    return this.prisma.playlistTrack
      .create({
        data: toPrisma(playlistTrack),
      })
      .then(toDomain);
  }
  async getTracksByPlaylistId(
    playlistId: PlaylistId,
  ): Promise<PlaylistTrack[]> {
    return this.prisma.playlistTrack
      .findMany({
        where: {
          playlistId: extractModelId(playlistId).dbId,
          createdById: getCurrentUserId(),
        },
      })
      .then((rows) => rows.map(toDomain));
  }
  async getTracks(): Promise<PlaylistTrack[]> {
    return this.prisma.playlistTrack
      .findMany({
        where: {
          createdById: getCurrentUserId(),
        },
      })
      .then((rows) => rows.map(toDomain));
  }

  async getTrackForPlaylist(
    playlistId: PlaylistId,
    trackId: MusicTrackId,
  ): Promise<PlaylistTrackWithTrackDetail> {
    return this.prisma.playlistTrack
      .findFirstOrThrow({
        where: {
          playlistId: extractModelId(playlistId).dbId,
          trackId: extractModelId(trackId).dbId,
          createdById: getCurrentUserId(),
        },
        include: {
          track: {
            include: {
              audioFingerprint: true,
              trackGenres: {
                include: {
                  genre: true,
                },
              },
              trackSubgenres: {
                include: {
                  subgenre: true,
                },
              },
              imageSearches: true,
            },
          },
        },
      })
      .then((row) => ({
        ...toDomain(row),
        track: toDomainMusicTrack(row.track),
      }))
      .catch((e: unknown) =>
        handlePrismaNotFound(
          e,
          `Playlist track with ID ${playlistId} and track ID ${trackId} not found`,
        ),
      );
  }

  async getTracksWithTrack(): Promise<PlaylistTrackWithTrackDetail[]> {
    return this.prisma.playlistTrack
      .findMany({
        where: {
          createdById: getCurrentUserId(),
        },
        include: {
          track: {
            include: {
              audioFingerprint: true,
              trackGenres: {
                include: {
                  genre: true,
                },
              },
              trackSubgenres: {
                include: {
                  subgenre: true,
                },
              },
              imageSearches: true,
            },
          },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          ...toDomain(row),
          track: toDomainMusicTrack(row.track),
        })),
      );
  }
  async getTracksByPlaylistIdWithTrack(
    playlistId: PlaylistId,
    sorting: PlaylistSortingOptions = {
      sortingKey: 'position',
      sortingDirection: 'asc',
    },
  ): Promise<PlaylistTrackWithTrackDetail[]> {
    return this.prisma.playlistTrack
      .findMany({
        where: {
          createdById: getCurrentUserId(),
          playlistId: extractModelId(playlistId).dbId,
        },
        include: {
          track: {
            include: {
              audioFingerprint: true,
              trackGenres: {
                include: {
                  genre: true,
                },
              },
              trackSubgenres: {
                include: {
                  subgenre: true,
                },
              },
              imageSearches: true,
            },
          },
        },
        orderBy: {
          [sorting.sortingKey]: sorting.sortingDirection,
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          ...toDomain(row),
          track: toDomainMusicTrack(row.track),
        })),
      );
  }
  async getPresenceBatch(
    pairs: Array<{ playlistId: PlaylistId; trackId: MusicTrackId }>,
  ): Promise<PlaylistTrackPresence[]> {
    return this.prisma.playlistTrack
      .findMany({
        where: {
          OR: pairs.map((pair) => ({
            playlistId: extractModelId(pair.playlistId).dbId,
            trackId: extractModelId(pair.trackId).dbId,
          })),
          createdById: getCurrentUserId(),
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          playlistId: models.playlist.id(row.playlistId),
          trackId: models.musicTrack.id(row.trackId),
          presence: true,
        })),
      );
  }
  verifyPresence(
    playlistId: PlaylistId,
    trackId: MusicTrackId,
  ): Promise<boolean> {
    return this.prisma.playlistTrack
      .findUnique({
        where: {
          playlistId_trackId: {
            playlistId: extractModelId(playlistId).dbId,
            trackId: extractModelId(trackId).dbId,
          },
        },
      })
      .then((row) => row !== null);
  }

  getLastPosition(playlistId: PlaylistId): Promise<number> {
    return this.prisma.playlistTrack
      .findFirst({
        where: { playlistId: extractModelId(playlistId).dbId },
        orderBy: { position: 'desc' },
      })
      .then((row) => row?.position ?? 0);
  }
}
