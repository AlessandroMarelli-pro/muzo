import { Test } from '@nestjs/testing';
import {
  AnalysisStatus as PrismaAnalysisStatus,
  MusicTrack as PrismaMusicTrack,
  PlaylistTrack as PrismaPlaylistTrack,
} from '@prisma/client';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { PlaylistTrackRepository } from 'src/adapters/persistence/repositories/playlist-track/playlist-track.repository';
import { createMockPrisma } from '../_test-utils/prisma-mock';
import { models } from 'src/kernel/types/models';
import type { PlaylistTrack } from 'src/kernel/types/model-types';
import { MusicTrackId, PlaylistId, PlaylistTrackId } from 'src/kernel/ids';

const TEST_USER_ID = 'test-user-id';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: 'User:test-user-id' })),
}));

function makePrismaPlaylistTrackRow(
  overrides: Partial<PrismaPlaylistTrack> = {},
): PrismaPlaylistTrack {
  return {
    id: 'pt-1',
    playlistId: 'playlist-1',
    trackId: 'track-1',
    position: 0,
    addedAt: new Date(),
    createdAt: new Date(),
    createdById: TEST_USER_ID,
    updatedAt: null,
    updatedById: null,
    ...overrides,
  };
}

/** Minimal Prisma MusicTrack row for include shape (getTrackForPlaylist, getTracksWithTrack, etc.). */
function makeMinimalPrismaTrackRow(overrides: Partial<PrismaMusicTrack> = {}): PrismaMusicTrack & {
  audioFingerprint?: null;
  trackGenres?: never[];
  trackSubgenres?: never[];
  imageSearches?: never[];
} {
  return {
    id: 'track-1',
    filePath: '/music/song.mp3',
    fileName: 'song.mp3',
    fileSize: 1024,
    format: 'MP3',
    bitrate: null,
    sampleRate: null,
    fileCreatedAt: new Date(),
    duration: 120,
    originalTitle: 'Song',
    originalArtist: 'Artist',
    originalAlbum: null,
    originalYear: null,
    originalAlbumartist: null,
    originalDate: null,
    originalBpm: null,
    originalTrack_number: null,
    originalDisc_number: null,
    originalComment: null,
    originalComposer: null,
    originalCopyright: null,
    aiTitle: null,
    aiArtist: null,
    aiAlbum: null,
    aiConfidence: null,
    aiSubgenreConfidence: null,
    aiDescription: null,
    aiTags: null,
    vocalsDesc: null,
    atmosphereDesc: null,
    contextBackground: null,
    contextImpact: null,
    userTitle: null,
    userArtist: null,
    userAlbum: null,
    userTags: null,
    listeningCount: 0,
    lastPlayedAt: null,
    isFavorite: false,
    isLiked: false,
    isBanger: false,
    analysisStatus: PrismaAnalysisStatus.COMPLETED,
    analysisStartedAt: new Date(),
    analysisCompletedAt: new Date(),
    analysisError: null,
    hasMusicbrainz: null,
    hasDiscogs: null,
    createdAt: new Date(),
    createdById: TEST_USER_ID,
    updatedAt: null,
    updatedById: null,
    libraryId: 'lib-1',
    audioFingerprint: undefined,
    trackGenres: [],
    trackSubgenres: [],
    imageSearches: [],
    ...overrides,
  } as PrismaMusicTrack & {
    audioFingerprint?: null;
    trackGenres?: never[];
    trackSubgenres?: never[];
    imageSearches?: never[];
  };
}

function makeDomainPlaylistTrack(overrides: Partial<PlaylistTrack> = {}): PlaylistTrack {
  return {
    id: models.playlistTrack.id('pt-1'),
    createdAt: new Date(),
    createdById: models.user.id(TEST_USER_ID),
    updatedAt: undefined,
    updatedById: undefined,
    trackId: models.musicTrack.id('track-1'),
    playlistId: models.playlist.id('playlist-1'),
    position: 0,
    addedAt: new Date(),
    ...overrides,
  };
}

describe('PlaylistTrackRepository', () => {
  let repo: PlaylistTrackRepository;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [PlaylistTrackRepository, { provide: PRISMA_SERVICE, useValue: prismaMock }],
    }).compile();
    repo = module.get(PlaylistTrackRepository);
  });

  describe('save', () => {
    it('optimal: creates a playlist track and returns domain model', async () => {
      const domain = makeDomainPlaylistTrack();
      const row = makePrismaPlaylistTrackRow({
        id: 'pt-1',
        playlistId: 'playlist-1',
        trackId: 'track-1',
        position: domain.position,
      });
      prismaMock.playlistTrack.create.mockResolvedValue(row);

      const result = await repo.save(domain);

      expect(prismaMock.playlistTrack.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          playlistId: 'playlist-1',
          trackId: 'track-1',
          position: domain.position,
          createdById: TEST_USER_ID,
        }),
      });
      expect(result.id).toBeDefined();
      expect(result.playlistId).toEqual(domain.playlistId);
      expect(result.trackId).toEqual(domain.trackId);
    });

    it('failure: rethrows when Prisma create throws', async () => {
      const domain = makeDomainPlaylistTrack();
      const prismaError = new Error('Unique constraint failed');
      prismaMock.playlistTrack.create.mockRejectedValue(prismaError);

      await expect(repo.save(domain)).rejects.toThrow('Unique constraint failed');
    });

    it('createdById scope: create is called with current user id in data', async () => {
      const domain = makeDomainPlaylistTrack();
      const row = makePrismaPlaylistTrackRow();
      prismaMock.playlistTrack.create.mockResolvedValue(row);

      await repo.save(domain);

      expect(prismaMock.playlistTrack.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ createdById: TEST_USER_ID }),
      });
    });
  });

  describe('saveMany', () => {
    it('optimal: creates many playlist tracks and returns domain models', async () => {
      const domain1 = makeDomainPlaylistTrack({
        id: models.playlistTrack.id('pt-1'),
      });
      const domain2 = makeDomainPlaylistTrack({
        id: models.playlistTrack.id('pt-2'),
        position: 1,
      });
      const rows = [
        makePrismaPlaylistTrackRow({ id: 'pt-1' }),
        makePrismaPlaylistTrackRow({ id: 'pt-2', position: 1 }),
      ];
      prismaMock.playlistTrack.createManyAndReturn.mockResolvedValue(rows);

      const result = await repo.saveMany([domain1, domain2]);

      expect(prismaMock.playlistTrack.createManyAndReturn).toHaveBeenCalledWith({
        data: expect.any(Array),
      });
      expect(result).toHaveLength(2);
      expect(result[0].position).toBe(0);
      expect(result[1].position).toBe(1);
    });

    it('failure: rethrows when Prisma createManyAndReturn throws', async () => {
      const domain = makeDomainPlaylistTrack();
      prismaMock.playlistTrack.createManyAndReturn.mockRejectedValue(new Error('DB error'));

      await expect(repo.saveMany([domain])).rejects.toThrow('DB error');
    });

    it('createdById scope: data items include current user id (via toPrisma from domain)', async () => {
      const domain = makeDomainPlaylistTrack();
      const row = makePrismaPlaylistTrackRow();
      prismaMock.playlistTrack.createManyAndReturn.mockResolvedValue([row]);

      await repo.saveMany([domain]);

      expect(prismaMock.playlistTrack.createManyAndReturn).toHaveBeenCalledWith({
        data: expect.arrayContaining([expect.objectContaining({ createdById: TEST_USER_ID })]),
      });
    });
  });

  describe('getTracksByPlaylistId', () => {
    it('optimal: returns playlist tracks for playlist and current user', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const rows = [
        makePrismaPlaylistTrackRow({ id: 'pt-1' }),
        makePrismaPlaylistTrackRow({ id: 'pt-2', position: 1 }),
      ];
      prismaMock.playlistTrack.findMany.mockResolvedValue(rows);

      const result = await repo.getTracksByPlaylistId(playlistId);

      expect(prismaMock.playlistTrack.findMany).toHaveBeenCalledWith({
        where: {
          playlistId: 'playlist-1',
          createdById: TEST_USER_ID,
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0].playlistId).toEqual(playlistId);
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getTracksByPlaylistId(playlistId)).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.findMany.mockResolvedValue([]);

      await repo.getTracksByPlaylistId(playlistId);

      expect(prismaMock.playlistTrack.findMany).toHaveBeenCalledWith({
        where: {
          playlistId: 'playlist-1',
          createdById: TEST_USER_ID,
        },
      });
    });

    it('empty result: returns empty array when no tracks', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.findMany.mockResolvedValue([]);

      const result = await repo.getTracksByPlaylistId(playlistId);

      expect(result).toEqual([]);
    });
  });

  describe('getTracks', () => {
    it('optimal: returns all playlist tracks for current user', async () => {
      const rows = [
        makePrismaPlaylistTrackRow({ id: 'pt-1' }),
        makePrismaPlaylistTrackRow({ id: 'pt-2' }),
      ];
      prismaMock.playlistTrack.findMany.mockResolvedValue(rows);

      const result = await repo.getTracks();

      expect(prismaMock.playlistTrack.findMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
      });
      expect(result).toHaveLength(2);
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      prismaMock.playlistTrack.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getTracks()).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      prismaMock.playlistTrack.findMany.mockResolvedValue([]);

      await repo.getTracks();

      expect(prismaMock.playlistTrack.findMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
      });
    });

    it('empty result: returns empty array when no tracks', async () => {
      prismaMock.playlistTrack.findMany.mockResolvedValue([]);

      const result = await repo.getTracks();

      expect(result).toEqual([]);
    });
  });

  describe('getTrackForPlaylist', () => {
    it('optimal: returns playlist track with track detail when found', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      const row = {
        ...makePrismaPlaylistTrackRow(),
        track: makeMinimalPrismaTrackRow({ id: 'track-1' }),
      };
      prismaMock.playlistTrack.findFirstOrThrow.mockResolvedValue(row);

      const result = await repo.getTrackForPlaylist(playlistId, trackId);

      expect(prismaMock.playlistTrack.findFirstOrThrow).toHaveBeenCalledWith({
        where: {
          playlistId: 'playlist-1',
          trackId: 'track-1',
          createdById: TEST_USER_ID,
        },
        include: expect.objectContaining({
          track: expect.objectContaining({
            include: expect.any(Object),
          }),
        }),
      });
      expect(result.playlistId).toEqual(playlistId);
      expect(result.trackId).toEqual(trackId);
      expect(result.track).toBeDefined();
    });

    it('failure: throws NotFoundError when Prisma throws P2025', async () => {
      const playlistId = models.playlist.id('playlist-missing') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.playlistTrack.findFirstOrThrow.mockRejectedValue({
        code: 'P2025',
      });

      await expect(repo.getTrackForPlaylist(playlistId, trackId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: expect.stringContaining('playlist-missing'),
      });
    });

    it('failure: rethrows when Prisma throws non-P2025 error', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.playlistTrack.findFirstOrThrow.mockRejectedValue(new Error('Connection lost'));

      await expect(repo.getTrackForPlaylist(playlistId, trackId)).rejects.toThrow(
        'Connection lost',
      );
    });

    it('createdById scope: findFirstOrThrow is called with current user in where', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      const row = {
        ...makePrismaPlaylistTrackRow(),
        track: makeMinimalPrismaTrackRow(),
      };
      prismaMock.playlistTrack.findFirstOrThrow.mockResolvedValue(row);

      await repo.getTrackForPlaylist(playlistId, trackId);

      expect(prismaMock.playlistTrack.findFirstOrThrow).toHaveBeenCalledWith({
        where: {
          playlistId: 'playlist-1',
          trackId: 'track-1',
          createdById: TEST_USER_ID,
        },
        include: expect.any(Object),
      });
    });

    it('empty result: not found yields NotFoundError (P2025)', async () => {
      const playlistId = models.playlist.id('playlist-nonexistent') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.playlistTrack.findFirstOrThrow.mockRejectedValue({
        code: 'P2025',
      });

      await expect(repo.getTrackForPlaylist(playlistId, trackId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: expect.stringContaining('playlist-nonexistent'),
      });
    });
  });

  describe('getTracksWithTrack', () => {
    it('optimal: returns playlist tracks with track detail for current user', async () => {
      const row = {
        ...makePrismaPlaylistTrackRow(),
        track: makeMinimalPrismaTrackRow(),
      };
      prismaMock.playlistTrack.findMany.mockResolvedValue([row]);

      const result = await repo.getTracksWithTrack();

      expect(prismaMock.playlistTrack.findMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
        include: expect.objectContaining({
          track: expect.objectContaining({ include: expect.any(Object) }),
        }),
      });
      expect(result).toHaveLength(1);
      expect(result[0].track).toBeDefined();
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      prismaMock.playlistTrack.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getTracksWithTrack()).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      prismaMock.playlistTrack.findMany.mockResolvedValue([]);

      await repo.getTracksWithTrack();

      expect(prismaMock.playlistTrack.findMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
        include: expect.any(Object),
      });
    });

    it('empty result: returns empty array when no tracks', async () => {
      prismaMock.playlistTrack.findMany.mockResolvedValue([]);

      const result = await repo.getTracksWithTrack();

      expect(result).toEqual([]);
    });
  });

  describe('getTracksByPlaylistIdWithTrack', () => {
    it('optimal: returns playlist tracks with track detail and default sorting', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const row = {
        ...makePrismaPlaylistTrackRow(),
        track: makeMinimalPrismaTrackRow(),
      };
      prismaMock.playlistTrack.findMany.mockResolvedValue([row]);

      const result = await repo.getTracksByPlaylistIdWithTrack(playlistId);

      expect(prismaMock.playlistTrack.findMany).toHaveBeenCalledWith({
        where: {
          createdById: TEST_USER_ID,
          playlistId: 'playlist-1',
        },
        include: expect.objectContaining({
          track: expect.objectContaining({ include: expect.any(Object) }),
        }),
        orderBy: { position: 'asc' },
      });
      expect(result).toHaveLength(1);
    });

    it('optimal: passes sorting options when provided', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.findMany.mockResolvedValue([]);

      await repo.getTracksByPlaylistIdWithTrack(playlistId, {
        sortingKey: 'addedAt',
        sortingDirection: 'desc',
      });

      expect(prismaMock.playlistTrack.findMany).toHaveBeenCalledWith({
        where: {
          createdById: TEST_USER_ID,
          playlistId: 'playlist-1',
        },
        include: expect.any(Object),
        orderBy: { addedAt: 'desc' },
      });
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getTracksByPlaylistIdWithTrack(playlistId)).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.findMany.mockResolvedValue([]);

      await repo.getTracksByPlaylistIdWithTrack(playlistId);

      expect(prismaMock.playlistTrack.findMany).toHaveBeenCalledWith({
        where: {
          createdById: TEST_USER_ID,
          playlistId: 'playlist-1',
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('empty result: returns empty array when no tracks', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.findMany.mockResolvedValue([]);

      const result = await repo.getTracksByPlaylistIdWithTrack(playlistId);

      expect(result).toEqual([]);
    });
  });

  describe('getPresenceBatch', () => {
    it('optimal: returns presence true for found pairs', async () => {
      const pairs = [
        {
          playlistId: models.playlist.id('playlist-1') as PlaylistId,
          trackId: models.musicTrack.id('track-1') as MusicTrackId,
        },
      ];
      const row = makePrismaPlaylistTrackRow({
        playlistId: 'playlist-1',
        trackId: 'track-1',
      });
      prismaMock.playlistTrack.findMany.mockResolvedValue([row]);

      const result = await repo.getPresenceBatch(pairs);

      expect(prismaMock.playlistTrack.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ playlistId: 'playlist-1', trackId: 'track-1' }],
          createdById: TEST_USER_ID,
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        playlistId: models.playlist.id('playlist-1'),
        trackId: models.musicTrack.id('track-1'),
        presence: true,
      });
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      const pairs = [
        {
          playlistId: models.playlist.id('playlist-1') as PlaylistId,
          trackId: models.musicTrack.id('track-1') as MusicTrackId,
        },
      ];
      prismaMock.playlistTrack.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getPresenceBatch(pairs)).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      const pairs = [
        {
          playlistId: models.playlist.id('playlist-1') as PlaylistId,
          trackId: models.musicTrack.id('track-1') as MusicTrackId,
        },
      ];
      prismaMock.playlistTrack.findMany.mockResolvedValue([]);

      await repo.getPresenceBatch(pairs);

      expect(prismaMock.playlistTrack.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ playlistId: 'playlist-1', trackId: 'track-1' }],
          createdById: TEST_USER_ID,
        },
      });
    });

    it('empty result: returns empty array when no pairs match', async () => {
      const pairs = [
        {
          playlistId: models.playlist.id('playlist-1') as PlaylistId,
          trackId: models.musicTrack.id('track-1') as MusicTrackId,
        },
      ];
      prismaMock.playlistTrack.findMany.mockResolvedValue([]);

      const result = await repo.getPresenceBatch(pairs);

      expect(result).toEqual([]);
    });
  });

  describe('verifyPresence', () => {
    it('optimal: returns true when playlist track exists', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      const row = makePrismaPlaylistTrackRow();
      prismaMock.playlistTrack.findFirst.mockResolvedValue(row);

      const result = await repo.verifyPresence(playlistId, trackId);

      expect(prismaMock.playlistTrack.findFirst).toHaveBeenCalledWith({
        where: {
          playlistId: 'playlist-1',
          trackId: 'track-1',
          createdById: TEST_USER_ID,
        },
      });
      expect(result).toBe(true);
    });

    it('optimal: returns false when playlist track does not exist', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.playlistTrack.findFirst.mockResolvedValue(null);

      const result = await repo.verifyPresence(playlistId, trackId);

      expect(result).toBe(false);
    });

    it('failure: rethrows when Prisma findFirst throws', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.playlistTrack.findFirst.mockRejectedValue(new Error('DB error'));

      await expect(repo.verifyPresence(playlistId, trackId)).rejects.toThrow('DB error');
    });

    it('createdById scope: findFirst is called with current user in where', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.playlistTrack.findFirst.mockResolvedValue(null);

      await repo.verifyPresence(playlistId, trackId);

      expect(prismaMock.playlistTrack.findFirst).toHaveBeenCalledWith({
        where: {
          playlistId: 'playlist-1',
          trackId: 'track-1',
          createdById: TEST_USER_ID,
        },
      });
    });
  });

  describe('getLastPosition', () => {
    it('optimal: returns last position when tracks exist', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const row = makePrismaPlaylistTrackRow({ position: 5 });
      prismaMock.playlistTrack.findFirst.mockResolvedValue(row);

      const result = await repo.getLastPosition(playlistId);

      expect(prismaMock.playlistTrack.findFirst).toHaveBeenCalledWith({
        where: {
          playlistId: 'playlist-1',
          createdById: TEST_USER_ID,
        },
        orderBy: { position: 'desc' },
      });
      expect(result).toBe(5);
    });

    it('optimal: returns 0 when no tracks in playlist', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.findFirst.mockResolvedValue(null);

      const result = await repo.getLastPosition(playlistId);

      expect(result).toBe(0);
    });

    it('failure: rethrows when Prisma findFirst throws', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.findFirst.mockRejectedValue(new Error('DB error'));

      await expect(repo.getLastPosition(playlistId)).rejects.toThrow('DB error');
    });

    it('createdById scope: findFirst is called with current user in where', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.findFirst.mockResolvedValue(null);

      await repo.getLastPosition(playlistId);

      expect(prismaMock.playlistTrack.findFirst).toHaveBeenCalledWith({
        where: {
          playlistId: 'playlist-1',
          createdById: TEST_USER_ID,
        },
        orderBy: { position: 'desc' },
      });
    });
  });

  describe('removeTrackFromPlaylist', () => {
    it('optimal: deletes playlist track and returns domain model', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      const row = makePrismaPlaylistTrackRow();
      prismaMock.playlistTrack.delete.mockResolvedValue(row);

      const result = await repo.removeTrackFromPlaylist(playlistId, trackId);

      expect(prismaMock.playlistTrack.delete).toHaveBeenCalledWith({
        where: {
          playlistId_trackId: {
            playlistId: 'playlist-1',
            trackId: 'track-1',
          },
          createdById: TEST_USER_ID,
        },
      });
      expect(result.playlistId).toEqual(playlistId);
      expect(result.trackId).toEqual(trackId);
    });

    it('failure: throws NotFoundError when Prisma throws P2025', async () => {
      const playlistId = models.playlist.id('playlist-missing') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.playlistTrack.delete.mockRejectedValue({ code: 'P2025' });

      await expect(repo.removeTrackFromPlaylist(playlistId, trackId)).rejects.toMatchObject({
        errorType: 'NotFoundError',
        message: expect.stringContaining('playlist-missing'),
      });
    });

    it('failure: rethrows when Prisma throws non-P2025 error', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      prismaMock.playlistTrack.delete.mockRejectedValue(new Error('Constraint failed'));

      await expect(repo.removeTrackFromPlaylist(playlistId, trackId)).rejects.toThrow(
        'Constraint failed',
      );
    });

    it('createdById scope: delete is called with current user in where', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      const trackId = models.musicTrack.id('track-1') as MusicTrackId;
      const row = makePrismaPlaylistTrackRow();
      prismaMock.playlistTrack.delete.mockResolvedValue(row);

      await repo.removeTrackFromPlaylist(playlistId, trackId);

      expect(prismaMock.playlistTrack.delete).toHaveBeenCalledWith({
        where: {
          playlistId_trackId: {
            playlistId: 'playlist-1',
            trackId: 'track-1',
          },
          createdById: TEST_USER_ID,
        },
      });
    });
  });

  describe('updateOneById', () => {
    it('optimal: updates position and returns domain model', async () => {
      const id = models.playlistTrack.id('pt-1') as PlaylistTrackId;
      const updatedRow = makePrismaPlaylistTrackRow({
        id: 'pt-1',
        position: 2,
      });
      prismaMock.playlistTrack.update.mockResolvedValue(updatedRow);

      const result = await repo.updateOneById(id, { position: 2 });

      expect(prismaMock.playlistTrack.update).toHaveBeenCalledWith({
        where: { id: 'pt-1', createdById: TEST_USER_ID },
        data: { position: 2 },
      });
      expect(result.position).toBe(2);
    });

    it('failure: rethrows when Prisma update throws', async () => {
      const id = models.playlistTrack.id('pt-missing') as PlaylistTrackId;
      prismaMock.playlistTrack.update.mockRejectedValue({ code: 'P2025' });

      await expect(repo.updateOneById(id, { position: 1 })).rejects.toMatchObject({
        code: 'P2025',
      });
    });

    it('createdById scope: update is called with current user in where', async () => {
      const id = models.playlistTrack.id('pt-1') as PlaylistTrackId;
      const updatedRow = makePrismaPlaylistTrackRow();
      prismaMock.playlistTrack.update.mockResolvedValue(updatedRow);

      await repo.updateOneById(id, { position: 1 });

      expect(prismaMock.playlistTrack.update).toHaveBeenCalledWith({
        where: { id: 'pt-1', createdById: TEST_USER_ID },
        data: expect.any(Object),
      });
    });
  });

  describe('decrementTracksPosition', () => {
    it('optimal: decrements positions and returns true', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.updateMany.mockResolvedValue({ count: 3 });

      const result = await repo.decrementTracksPosition(playlistId, 1);

      expect(prismaMock.playlistTrack.updateMany).toHaveBeenCalledWith({
        where: {
          playlistId: 'playlist-1',
          createdById: TEST_USER_ID,
          position: { gt: 1 },
        },
        data: { position: { decrement: 1 } },
      });
      expect(result).toBe(true);
    });

    it('failure: rethrows when Prisma updateMany throws', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.updateMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.decrementTracksPosition(playlistId, 0)).rejects.toThrow('DB error');
    });

    it('createdById scope: updateMany is called with current user in where', async () => {
      const playlistId = models.playlist.id('playlist-1') as PlaylistId;
      prismaMock.playlistTrack.updateMany.mockResolvedValue({ count: 0 });

      await repo.decrementTracksPosition(playlistId, 5);

      expect(prismaMock.playlistTrack.updateMany).toHaveBeenCalledWith({
        where: {
          playlistId: 'playlist-1',
          createdById: TEST_USER_ID,
          position: { gt: 5 },
        },
        data: { position: { decrement: 1 } },
      });
    });
  });
});
