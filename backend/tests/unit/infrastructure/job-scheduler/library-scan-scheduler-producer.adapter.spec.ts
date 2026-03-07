import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  EndLibraryScanJobData,
  LibraryScanJobData,
} from 'src/application/ports/dtos/JobSchedulersData';
import { LibraryScanSchedulerProducerAdapter } from 'src/infrastructure/job-scheduler/library-scan-scheduler-producer.adapter';
import { models } from 'src/kernel/types/models';
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
      const libraryId = models.musicLibrary.id('lib-1');
      const sessionId = models.session.id('session-1');
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
      const libraryId = models.musicLibrary.id('lib-1');
      const sessionId = models.session.id('session-1');
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
          models.musicLibrary.id('lib-1'),
          models.session.id('session-1'),
          makeContextUser('user-1'),
          false,
        ),
      ).rejects.toThrow('Redis connection failed');
    });
  });
});
