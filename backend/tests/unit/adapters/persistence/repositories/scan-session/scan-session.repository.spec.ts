import { Test } from '@nestjs/testing';
import { type Mock } from 'vitest';
import { ScanSession as PrismaScanSession, ScanStatus as PrismaScanStatus } from '@prisma/client';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { ScanSessionRepository } from 'src/adapters/persistence/repositories/scan-session/scan-session.repository';
import { createMockPrisma } from '../_test-utils/prisma-mock';
import { models } from 'src/kernel/types/models';
import { SessionId } from 'src/kernel/ids';

const TEST_USER_ID = 'test-user-id';
const SESSION_DB_ID = 'session-uuid-1';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  getCurrentUser: vi.fn(() => ({ id: 'User:test-user-id' })),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: 'User:test-user-id' })),
}));

function makePrismaScanSessionRow(overrides: Partial<PrismaScanSession> = {}): PrismaScanSession {
  return {
    id: SESSION_DB_ID,
    sessionId: SESSION_DB_ID,
    status: PrismaScanStatus.SCANNING,
    totalBatches: 0,
    completedBatches: 0,
    totalTracks: 0,
    completedTracks: 0,
    failedTracks: 0,
    overallProgress: 0,
    startedAt: new Date(),
    completedAt: null,
    errorMessage: null,
    createdAt: new Date(),
    createdById: TEST_USER_ID,
    updatedAt: null,
    updatedById: null,
    ...overrides,
  };
}

describe('ScanSessionRepository', () => {
  let repo: ScanSessionRepository;
  let prismaMock: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [ScanSessionRepository, { provide: PRISMA_SERVICE, useValue: prismaMock }],
    }).compile();
    repo = module.get(ScanSessionRepository);
  });

  describe('createSession', () => {
    it('optimal: creates a session and returns domain model', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      const row = makePrismaScanSessionRow();
      prismaMock.scanSession.create.mockResolvedValue(row);

      const result = await repo.createSession(sessionId);

      expect(prismaMock.scanSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'SCANNING',
          totalBatches: 0,
          completedBatches: 0,
          totalTracks: 0,
          overallProgress: 0,
          createdById: TEST_USER_ID,
        }),
      });
      expect(result.status).toBe('SCANNING');
      expect(result.totalBatches).toBe(0);
    });

    it('failure: rethrows when Prisma create throws', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      const prismaError = new Error('Unique constraint failed');
      prismaMock.scanSession.create.mockRejectedValue(prismaError);

      await expect(repo.createSession(sessionId)).rejects.toThrow('Unique constraint failed');
    });

    it('createdById scope: create is called with current user id in data', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      const row = makePrismaScanSessionRow();
      prismaMock.scanSession.create.mockResolvedValue(row);

      await repo.createSession(sessionId);

      expect(prismaMock.scanSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ createdById: TEST_USER_ID }),
      });
    });
  });

  describe('updateSession', () => {
    it('optimal: updates session and returns domain model', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      const updatedRow = makePrismaScanSessionRow({
        totalBatches: 5,
        completedBatches: 2,
      });
      prismaMock.scanSession.update.mockResolvedValue(updatedRow);

      const result = await repo.updateSession(sessionId, {
        totalBatches: 5,
        completedBatches: 2,
      });

      expect(prismaMock.scanSession.update).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
        data: expect.any(Object),
      });
      expect(result.totalBatches).toBe(5);
      expect(result.completedBatches).toBe(2);
    });

    it('failure: rethrows when Prisma update throws (e.g. P2025 not found)', async () => {
      const sessionId = models.session.id('missing-session') as SessionId;
      prismaMock.scanSession.update.mockRejectedValue({ code: 'P2025' });

      await expect(repo.updateSession(sessionId, { totalBatches: 1 })).rejects.toMatchObject({
        code: 'P2025',
      });
    });

    it('createdById scope: update is called with current user in where', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      const updatedRow = makePrismaScanSessionRow();
      prismaMock.scanSession.update.mockResolvedValue(updatedRow);

      await repo.updateSession(sessionId, { status: 'IDLE' });

      expect(prismaMock.scanSession.update).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
        data: expect.any(Object),
      });
    });
  });

  describe('getSession', () => {
    it('optimal: returns session when found', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      const row = makePrismaScanSessionRow();
      prismaMock.scanSession.findFirst.mockResolvedValue(row);

      const result = await repo.getSession(sessionId);

      expect(prismaMock.scanSession.findFirst).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
      });
      expect(result).not.toBeNull();
      expect(result!.status).toBe('SCANNING');
    });

    it('failure: rethrows when Prisma findFirst throws', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      prismaMock.scanSession.findFirst.mockRejectedValue(new Error('Connection lost'));

      await expect(repo.getSession(sessionId)).rejects.toThrow('Connection lost');
    });

    it('createdById scope: findFirst is called with current user in where', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      const row = makePrismaScanSessionRow();
      prismaMock.scanSession.findFirst.mockResolvedValue(row);

      await repo.getSession(sessionId);

      expect(prismaMock.scanSession.findFirst).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
      });
    });

    it('empty result: returns null when no session found', async () => {
      const sessionId = models.session.id('nonexistent') as SessionId;
      prismaMock.scanSession.findFirst.mockResolvedValue(null);

      const result = await repo.getSession(sessionId);

      expect(result).toBeNull();
    });
  });

  describe('updateSessionProgress', () => {
    beforeEach(() => {
      (prismaMock.$transaction as Mock).mockImplementation(
        async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
      );
    });

    it('optimal: updates progress when session is SCANNING and returns domain model', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      const updatedRow = makePrismaScanSessionRow({
        overallProgress: 50,
        completedBatches: 1,
      });
      prismaMock.scanSession.findUnique.mockResolvedValue({
        status: PrismaScanStatus.SCANNING,
      } as PrismaScanSession);
      prismaMock.scanSession.update.mockResolvedValue(updatedRow);

      const result = await repo.updateSessionProgress(sessionId, {
        progressPercentage: 50,
        completedBatches: 1,
      });

      expect(prismaMock.scanSession.findUnique).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
        select: { status: true },
      });
      expect(prismaMock.scanSession.update).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
        data: expect.any(Object),
      });
      expect(result).not.toBeNull();
      expect(result!.overallProgress).toBe(50);
    });

    it('failure: rethrows when Prisma transaction throws', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      prismaMock.$transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(
        repo.updateSessionProgress(sessionId, { progressPercentage: 1 }),
      ).rejects.toThrow('Transaction failed');
    });

    it('createdById scope: findUnique and update are called with current user in where', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      prismaMock.scanSession.findUnique.mockResolvedValue({
        status: PrismaScanStatus.SCANNING,
      } as PrismaScanSession);
      prismaMock.scanSession.update.mockResolvedValue(makePrismaScanSessionRow());

      await repo.updateSessionProgress(sessionId, { completedBatches: 1 });

      expect(prismaMock.scanSession.findUnique).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
        select: { status: true },
      });
      expect(prismaMock.scanSession.update).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
        data: expect.any(Object),
      });
    });

    it('empty result: returns null when session is not in SCANNING status', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      prismaMock.scanSession.findUnique.mockResolvedValue({
        status: PrismaScanStatus.IDLE,
      } as PrismaScanSession);

      const result = await repo.updateSessionProgress(sessionId, {
        progressPercentage: 1,
      });

      expect(result).toBeNull();
      expect(prismaMock.scanSession.update).not.toHaveBeenCalled();
    });

    it('empty result: returns null when session does not exist', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      prismaMock.scanSession.findUnique.mockResolvedValue(null);

      const result = await repo.updateSessionProgress(sessionId, {
        progressPercentage: 1,
      });

      expect(result).toBeNull();
      expect(prismaMock.scanSession.update).not.toHaveBeenCalled();
    });
  });

  describe('completeSession', () => {
    it('optimal: marks session as IDLE and returns domain model', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      const updatedRow = makePrismaScanSessionRow({
        status: PrismaScanStatus.IDLE,
        overallProgress: 10000,
      });
      prismaMock.scanSession.update.mockResolvedValue(updatedRow);

      const result = await repo.completeSession(sessionId, true);

      expect(prismaMock.scanSession.update).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
        data: expect.objectContaining({
          status: 'IDLE',
          overallProgress: 10000,
        }),
      });
      expect(result.status).toBe('IDLE');
    });

    it('optimal: marks session as ERROR when success is false', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      const updatedRow = makePrismaScanSessionRow({
        status: PrismaScanStatus.ERROR,
      });
      prismaMock.scanSession.update.mockResolvedValue(updatedRow);

      await repo.completeSession(sessionId, false);

      expect(prismaMock.scanSession.update).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
        data: expect.objectContaining({ status: 'ERROR' }),
      });
    });

    it('failure: rethrows when Prisma update throws (e.g. P2025 not found)', async () => {
      const sessionId = models.session.id('missing') as SessionId;
      prismaMock.scanSession.update.mockRejectedValue({ code: 'P2025' });

      await expect(repo.completeSession(sessionId, true)).rejects.toMatchObject({ code: 'P2025' });
    });

    it('createdById scope: update is called with current user in where', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      const updatedRow = makePrismaScanSessionRow({
        status: PrismaScanStatus.IDLE,
      });
      prismaMock.scanSession.update.mockResolvedValue(updatedRow);

      await repo.completeSession(sessionId, true);

      expect(prismaMock.scanSession.update).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
        data: expect.any(Object),
      });
    });
  });

  describe('getActiveSessions', () => {
    it('optimal: returns active sessions (SCANNING or ANALYZING)', async () => {
      const rows = [
        makePrismaScanSessionRow({
          id: 's1',
          status: PrismaScanStatus.SCANNING,
        }),
        makePrismaScanSessionRow({
          id: 's2',
          status: PrismaScanStatus.ANALYZING,
        }),
      ];
      prismaMock.scanSession.findMany.mockResolvedValue(rows);

      const result = await repo.getActiveSessions();

      expect(prismaMock.scanSession.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['SCANNING', 'ANALYZING'] },
          createdById: TEST_USER_ID,
        },
        orderBy: { startedAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      prismaMock.scanSession.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getActiveSessions()).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      prismaMock.scanSession.findMany.mockResolvedValue([]);

      await repo.getActiveSessions();

      expect(prismaMock.scanSession.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['SCANNING', 'ANALYZING'] },
          createdById: TEST_USER_ID,
        },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('empty result: returns empty array when no active sessions', async () => {
      prismaMock.scanSession.findMany.mockResolvedValue([]);

      const result = await repo.getActiveSessions();

      expect(result).toEqual([]);
    });
  });

  describe('getCompletedSessions', () => {
    it('optimal: returns completed sessions (IDLE)', async () => {
      const rows = [
        makePrismaScanSessionRow({
          id: 's1',
          sessionId: 's1',
          status: PrismaScanStatus.IDLE,
        }),
      ];
      prismaMock.scanSession.findMany.mockResolvedValue(rows);

      const result = await repo.getCompletedSessions();

      expect(prismaMock.scanSession.findMany).toHaveBeenCalledWith({
        where: {
          status: 'IDLE',
          createdById: TEST_USER_ID,
        },
        orderBy: { startedAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('IDLE');
    });

    it('failure: rethrows when Prisma findMany throws', async () => {
      prismaMock.scanSession.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repo.getCompletedSessions()).rejects.toThrow('DB error');
    });

    it('createdById scope: findMany is called with current user in where', async () => {
      prismaMock.scanSession.findMany.mockResolvedValue([]);

      await repo.getCompletedSessions();

      expect(prismaMock.scanSession.findMany).toHaveBeenCalledWith({
        where: {
          status: 'IDLE',
          createdById: TEST_USER_ID,
        },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('empty result: returns empty array when no completed sessions', async () => {
      prismaMock.scanSession.findMany.mockResolvedValue([]);

      const result = await repo.getCompletedSessions();

      expect(result).toEqual([]);
    });
  });

  describe('deleteSession', () => {
    it('optimal: deletes session', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      prismaMock.scanSession.delete.mockResolvedValue(makePrismaScanSessionRow());

      await repo.deleteSession(sessionId);

      expect(prismaMock.scanSession.delete).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
      });
    });

    it('failure: rethrows when Prisma delete throws (e.g. P2025 not found)', async () => {
      const sessionId = models.session.id('missing') as SessionId;
      prismaMock.scanSession.delete.mockRejectedValue({ code: 'P2025' });

      await expect(repo.deleteSession(sessionId)).rejects.toMatchObject({
        code: 'P2025',
      });
    });

    it('createdById scope: delete is called with current user in where', async () => {
      const sessionId = models.session.id(SESSION_DB_ID) as SessionId;
      prismaMock.scanSession.delete.mockResolvedValue(makePrismaScanSessionRow());

      await repo.deleteSession(sessionId);

      expect(prismaMock.scanSession.delete).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_DB_ID,
          createdById: TEST_USER_ID,
        },
      });
    });
  });
});
