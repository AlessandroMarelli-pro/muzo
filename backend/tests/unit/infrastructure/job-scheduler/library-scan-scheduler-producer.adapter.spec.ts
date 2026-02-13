import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { LibraryScanSchedulerProducerAdapter } from 'src/infrastructure/job-scheduler/library-scan-scheduler-producer.adapter';
import {
  EndLibraryScanJobData,
  LibraryScanJobData,
} from 'src/application/ports/dtos/JobSchedulersData';
import { makeContextUser } from '../../../_test-utils/make-context-user';
import { makeQueueConfig } from './_test-utils/make-queue-config';

describe('LibraryScanSchedulerProducerAdapter', () => {
  let adapter: LibraryScanSchedulerProducerAdapter;
  let queueMock: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    queueMock = { add: vi.fn().mockResolvedValue({ id: 'job-1' }) };
    const module = await Test.createTestingModule({
      providers: [
        LibraryScanSchedulerProducerAdapter,
        {
          provide: getQueueToken('library-scan'),
          useValue: queueMock,
        },
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue(makeQueueConfig()) },
        },
      ],
    }).compile();
    adapter = module.get(LibraryScanSchedulerProducerAdapter);
  });

  describe('scheduleLibraryScan', () => {
    it('optimal: adds start-library-scan job and returns sessionId', async () => {
      const libraryId = 'lib-1' as const;
      const sessionId = 'session-1' as const;
      const incremental = false;
      const contextUser = makeContextUser('user-1');

      const result = await adapter.scheduleLibraryScan(
        libraryId,
        incremental,
        contextUser,
        sessionId,
      );

      expect(result).toEqual({ sessionId });
      expect(queueMock.add).toHaveBeenCalledTimes(1);
      expect(queueMock.add).toHaveBeenCalledWith('start-library-scan', {
        libraryId,
        sessionId,
        incremental,
        contextUser,
      } satisfies LibraryScanJobData);
    });
  });

  describe('scheduleEndLibraryScan', () => {
    it('optimal: adds end-scan-library job and returns sessionId', async () => {
      const libraryId = 'lib-1' as const;
      const sessionId = 'session-1' as const;
      const contextUser = makeContextUser('user-1');
      const incremental = true;

      const result = await adapter.scheduleEndLibraryScan(
        libraryId,
        sessionId,
        contextUser,
        incremental,
      );

      expect(result).toEqual({ sessionId });
      expect(queueMock.add).toHaveBeenCalledTimes(1);
      expect(queueMock.add).toHaveBeenCalledWith('end-scan-library', {
        libraryId,
        incremental,
        sessionId,
        contextUser,
      } satisfies EndLibraryScanJobData);
    });

    it('failure: queue.add throws and error propagates', async () => {
      const err = new Error('Redis connection failed');
      queueMock.add.mockRejectedValueOnce(err);

      await expect(
        adapter.scheduleEndLibraryScan(
          'lib-1' as const,
          'session-1' as const,
          makeContextUser('user-1'),
          false,
        ),
      ).rejects.toThrow('Redis connection failed');
    });
  });
});
