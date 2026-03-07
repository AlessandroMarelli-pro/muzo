import { Test } from '@nestjs/testing';
import { Queue as PrismaQueue } from '@prisma/client';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { QueueRepository } from 'src/adapters/persistence/repositories/queue/queue.repository';
import { createMockPrisma } from '../_test-utils/prisma-mock';
import { models } from 'src/kernel/types/models';
import type { QueueItem } from 'src/kernel/types/model-types';
import { MusicTrackId } from 'src/kernel/ids';

const TEST_USER_ID = 'test-user-id';
const TRACK_ID_DB = 'track-1';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => 'test-user-id'),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: 'User:test-user-id' })),
}));

/** Minimal Prisma Queue row; with include, track can be attached. */
function makePrismaQueueRow(
  overrides: Partial<PrismaQueue> & {
    track?: {
      originalArtist?: string | null;
      originalTitle?: string | null;
    } | null;
  } = {},
): PrismaQueue & {
  track?: {
    originalArtist?: string | null;
    originalTitle?: string | null;
  } | null;
} {
  return {
    id: 'queue-1',
    trackId: TRACK_ID_DB,
    position: 1,
    createdAt: new Date(),
    createdById: TEST_USER_ID,
    updatedAt: null,
    updatedById: null,
    ...overrides,
  } as PrismaQueue & {
    track?: {
      originalArtist?: string | null;
      originalTitle?: string | null;
    } | null;
  };
}

function makeDomainQueueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: models.queueItem.id('queue-1'),
    createdAt: new Date(),
    createdById: models.user.id(TEST_USER_ID),
    updatedAt: undefined,
    updatedById: undefined,
    trackId: models.musicTrack.id(TRACK_ID_DB) as MusicTrackId,
    position: 1,
    ...overrides,
  };
}

describe('QueueRepository', () => {
  let repo: QueueRepository;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [QueueRepository, { provide: PRISMA_SERVICE, useValue: prismaMock }],
    }).compile();
    repo = module.get(QueueRepository);
  });

  describe('getQueue', () => {
    it('optimal: returns queue items with tracks ordered by position', async () => {
      const rows = [
        makePrismaQueueRow({ id: 'q1', position: 1 }),
        makePrismaQueueRow({ id: 'q2', position: 2 }),
      ];
      prismaMock.queue.findMany.mockResolvedValue(rows);

      const result = await repo.getQueue();

      expect(prismaMock.queue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdById: TEST_USER_ID },
          orderBy: { position: 'asc' },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      prismaMock.queue.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getQueue()).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      prismaMock.queue.findMany.mockResolvedValue([]);

      await repo.getQueue();

      expect(prismaMock.queue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdById: TEST_USER_ID },
        }),
      );
    });

    it('empty result: returns empty array when queue is empty', async () => {
      prismaMock.queue.findMany.mockResolvedValue([]);

      const result = await repo.getQueue();

      expect(result).toEqual([]);
    });
  });

  describe('addTrack', () => {
    it('optimal: adds track at next position and returns queue item with track', async () => {
      const trackId = models.musicTrack.id(TRACK_ID_DB) as MusicTrackId;
      prismaMock.queue.findFirst.mockResolvedValue({ position: 0 } as Awaited<
        ReturnType<typeof prismaMock.queue.findFirst>
      >);
      const createdRow = makePrismaQueueRow({ id: 'q-new', position: 1 });
      prismaMock.queue.create.mockResolvedValue(createdRow);

      const result = await repo.addTrack(trackId);

      expect(prismaMock.queue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdById: TEST_USER_ID },
          orderBy: { position: 'desc' },
        }),
      );
      expect(prismaMock.queue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            trackId: TRACK_ID_DB,
            position: 1,
            createdById: TEST_USER_ID,
          },
        }),
      );
      expect(result).toBeDefined();
      expect(result.position).toBe(1);
      expect(result.trackId).toBeDefined();
    });

    it('failure: rethrows when Prisma create throws', async () => {
      const trackId = models.musicTrack.id(TRACK_ID_DB) as MusicTrackId;
      prismaMock.queue.findFirst.mockResolvedValue(
        null as Awaited<ReturnType<typeof prismaMock.queue.findFirst>>,
      );
      prismaMock.queue.create.mockRejectedValue(new Error('Unique constraint failed'));

      await expect(repo.addTrack(trackId)).rejects.toThrow('Unique constraint failed');
    });

    it('createdById scope: create is called with current user in data', async () => {
      const trackId = models.musicTrack.id(TRACK_ID_DB) as MusicTrackId;
      prismaMock.queue.findFirst.mockResolvedValue(
        null as Awaited<ReturnType<typeof prismaMock.queue.findFirst>>,
      );
      prismaMock.queue.create.mockResolvedValue(makePrismaQueueRow());

      await repo.addTrack(trackId);

      expect(prismaMock.queue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdById: TEST_USER_ID }),
        }),
      );
    });
  });

  describe('addTracks', () => {
    it('optimal: adds multiple tracks in order', async () => {
      const trackIds = [
        models.musicTrack.id('t1') as MusicTrackId,
        models.musicTrack.id('t2') as MusicTrackId,
      ];
      prismaMock.queue.findFirst.mockResolvedValue({ position: 0 } as Awaited<
        ReturnType<typeof prismaMock.queue.findFirst>
      >);
      prismaMock.queue.create
        .mockResolvedValueOnce(makePrismaQueueRow({ id: 'q1', trackId: 't1', position: 1 }))
        .mockResolvedValueOnce(makePrismaQueueRow({ id: 'q2', trackId: 't2', position: 2 }));

      const result = await repo.addTracks(trackIds);

      expect(prismaMock.queue.create).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('failure: rethrows when Prisma create throws', async () => {
      const trackIds = [models.musicTrack.id('t1') as MusicTrackId];
      prismaMock.queue.findFirst.mockResolvedValue(
        null as Awaited<ReturnType<typeof prismaMock.queue.findFirst>>,
      );
      prismaMock.queue.create.mockRejectedValue(new Error('DB error'));

      await expect(repo.addTracks(trackIds)).rejects.toThrow('DB error');
    });

    it('createdById scope: create is called with current user in data', async () => {
      const trackIds = [models.musicTrack.id(TRACK_ID_DB) as MusicTrackId];
      prismaMock.queue.findFirst.mockResolvedValue(
        null as Awaited<ReturnType<typeof prismaMock.queue.findFirst>>,
      );
      prismaMock.queue.create.mockResolvedValue(makePrismaQueueRow());

      await repo.addTracks(trackIds);

      expect(prismaMock.queue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdById: TEST_USER_ID }),
        }),
      );
    });
  });

  describe('removeTrack', () => {
    it('optimal: removes track and returns result with artist/title', async () => {
      const trackId = models.musicTrack.id(TRACK_ID_DB) as MusicTrackId;
      const deletedRow = makePrismaQueueRow({
        position: 1,
        track: { originalArtist: 'Artist', originalTitle: 'Title' },
      });
      prismaMock.queue.delete.mockResolvedValue(deletedRow);
      prismaMock.queue.updateMany.mockResolvedValue({ count: 0 });

      const result = await repo.removeTrack(trackId);

      expect(prismaMock.queue.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { trackId: TRACK_ID_DB, createdById: TEST_USER_ID },
        }),
      );
      expect(result.success).toBe(true);
      expect(result.artist).toBe('Artist');
      expect(result.title).toBe('Title');
    });

    it('failure: rethrows when Prisma delete throws', async () => {
      const trackId = models.musicTrack.id(TRACK_ID_DB) as MusicTrackId;
      prismaMock.queue.delete.mockRejectedValue(new Error('Record not found'));

      await expect(repo.removeTrack(trackId)).rejects.toThrow('Record not found');
    });

    it('createdById scope: delete is called with current user in where', async () => {
      const trackId = models.musicTrack.id(TRACK_ID_DB) as MusicTrackId;
      prismaMock.queue.delete.mockResolvedValue(makePrismaQueueRow());
      prismaMock.queue.updateMany.mockResolvedValue({ count: 0 });

      await repo.removeTrack(trackId);

      expect(prismaMock.queue.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { trackId: TRACK_ID_DB, createdById: TEST_USER_ID },
        }),
      );
    });
  });

  describe('updatePositions', () => {
    it('optimal: updates positions and returns full queue', async () => {
      const positions = [
        { trackId: models.musicTrack.id('t1') as MusicTrackId, position: 2 },
        { trackId: models.musicTrack.id('t2') as MusicTrackId, position: 1 },
      ];
      prismaMock.queue.update.mockResolvedValue(makePrismaQueueRow());
      prismaMock.queue.findMany.mockResolvedValue([
        makePrismaQueueRow({ id: 'q1', position: 1 }),
        makePrismaQueueRow({ id: 'q2', position: 2 }),
      ]);

      const result = await repo.updatePositions(positions);

      expect(prismaMock.queue.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.queue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdById: TEST_USER_ID },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('failure: rethrows when Prisma update throws', async () => {
      const positions = [{ trackId: models.musicTrack.id('t1') as MusicTrackId, position: 1 }];
      prismaMock.queue.update.mockRejectedValue(new Error('DB error'));

      await expect(repo.updatePositions(positions)).rejects.toThrow('DB error');
    });

    it('createdById scope: update and getQueue use current user in where', async () => {
      const positions = [
        {
          trackId: models.musicTrack.id(TRACK_ID_DB) as MusicTrackId,
          position: 1,
        },
      ];
      prismaMock.queue.update.mockResolvedValue(makePrismaQueueRow());
      prismaMock.queue.findMany.mockResolvedValue([]);

      await repo.updatePositions(positions);

      expect(prismaMock.queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { trackId: TRACK_ID_DB, createdById: TEST_USER_ID },
        }),
      );
      expect(prismaMock.queue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdById: TEST_USER_ID },
        }),
      );
    });
  });

  describe('findByTrackId', () => {
    it('optimal: returns queue item when found', async () => {
      const trackId = models.musicTrack.id(TRACK_ID_DB) as MusicTrackId;
      const row = makePrismaQueueRow({ trackId: TRACK_ID_DB });
      prismaMock.queue.findUnique.mockResolvedValue(row);

      const result = await repo.findByTrackId(trackId);

      expect(prismaMock.queue.findUnique).toHaveBeenCalledWith({
        where: { trackId: TRACK_ID_DB, createdById: TEST_USER_ID },
      });
      expect(result).not.toBeNull();
      expect(result!.trackId).toBeDefined();
      expect(result!.position).toBe(row.position);
    });

    it('failure: rethrows when Prisma findUnique throws', async () => {
      const trackId = models.musicTrack.id(TRACK_ID_DB) as MusicTrackId;
      prismaMock.queue.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(repo.findByTrackId(trackId)).rejects.toThrow('DB error');
    });

    it('createdById scope: findUnique is called with current user in where', async () => {
      const trackId = models.musicTrack.id(TRACK_ID_DB) as MusicTrackId;
      prismaMock.queue.findUnique.mockResolvedValue(makePrismaQueueRow());

      await repo.findByTrackId(trackId);

      expect(prismaMock.queue.findUnique).toHaveBeenCalledWith({
        where: { trackId: TRACK_ID_DB, createdById: TEST_USER_ID },
      });
    });

    it('empty result: returns null when track not in queue', async () => {
      const trackId = models.musicTrack.id(TRACK_ID_DB) as MusicTrackId;
      prismaMock.queue.findUnique.mockResolvedValue(null);

      const result = await repo.findByTrackId(trackId);

      expect(result).toBeNull();
    });
  });

  describe('getLastPosition', () => {
    it('optimal: returns last position when queue has items', async () => {
      prismaMock.queue.findFirst.mockResolvedValue({ position: 5 } as Awaited<
        ReturnType<typeof prismaMock.queue.findFirst>
      >);

      const result = await repo.getLastPosition();

      expect(prismaMock.queue.findFirst).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      expect(result).toBe(5);
    });

    it('failure: rethrows when Prisma findFirst throws', async () => {
      prismaMock.queue.findFirst.mockRejectedValue(new Error('DB error'));

      await expect(repo.getLastPosition()).rejects.toThrow('DB error');
    });

    it('createdById scope: findFirst is called with current user in where', async () => {
      prismaMock.queue.findFirst.mockResolvedValue(
        null as Awaited<ReturnType<typeof prismaMock.queue.findFirst>>,
      );

      await repo.getLastPosition();

      expect(prismaMock.queue.findFirst).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
    });

    it('empty result: returns null when queue is empty', async () => {
      prismaMock.queue.findFirst.mockResolvedValue(
        null as Awaited<ReturnType<typeof prismaMock.queue.findFirst>>,
      );

      const result = await repo.getLastPosition();

      expect(result).toBeNull();
    });
  });

  describe('resetQueue', () => {
    it('optimal: deletes all queue items and returns true when count > 0', async () => {
      prismaMock.queue.deleteMany.mockResolvedValue({ count: 3 });

      const result = await repo.resetQueue();

      expect(prismaMock.queue.deleteMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
      });
      expect(result).toBe(true);
    });

    it('optimal: returns false when queue was already empty', async () => {
      prismaMock.queue.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repo.resetQueue();

      expect(result).toBe(false);
    });

    it('failure: rethrows when Prisma deleteMany throws', async () => {
      prismaMock.queue.deleteMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.resetQueue()).rejects.toThrow('DB error');
    });

    it('createdById scope: deleteMany is called with current user in where', async () => {
      prismaMock.queue.deleteMany.mockResolvedValue({ count: 0 });

      await repo.resetQueue();

      expect(prismaMock.queue.deleteMany).toHaveBeenCalledWith({
        where: { createdById: TEST_USER_ID },
      });
    });
  });
});
