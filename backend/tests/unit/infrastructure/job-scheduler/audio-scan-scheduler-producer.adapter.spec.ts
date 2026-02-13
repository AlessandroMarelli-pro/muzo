import { ConfigService } from '@nestjs/config';
import { FileInfo } from 'src/application/ports/dtos/FileInfo';
import { AudioScanSchedulerProducerAdapter } from 'src/infrastructure/job-scheduler/audio-scan-scheduler-producer.adapter';
import { models } from 'src/kernel/types/models';
import { makeContextUser } from '../../../_test-utils/make-context-user';
import { makeQueueConfig } from './_test-utils/make-queue-config';

describe('AudioScanSchedulerProducerAdapter', () => {
  let adapter: AudioScanSchedulerProducerAdapter;
  let queueMock: { addBulk: ReturnType<typeof vi.fn> };
  let scanSessionRepositoryMock: { updateSession: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queueMock = { addBulk: vi.fn().mockResolvedValue([]) };
    scanSessionRepositoryMock = {
      updateSession: vi.fn().mockResolvedValue({}),
    };
    const configService = {
      get: vi.fn().mockReturnValue(makeQueueConfig()),
    } as unknown as ConfigService;
    adapter = new AudioScanSchedulerProducerAdapter(
      queueMock as any,
      configService,
      scanSessionRepositoryMock as any,
    );
  });

  describe('scheduleBatchAudioScan', () => {
    it('optimal: updates session and enqueues batches with correct job data and opts', async () => {
      const audioFiles: FileInfo[] = [
        {
          filePath: '/music/a.mp3',
          fileName: 'a.mp3',
          extension: '.mp3',
          fileSize: 100,
          lastModified: new Date(),
        },
        {
          filePath: '/music/b.mp3',
          fileName: 'b.mp3',
          extension: '.mp3',
          fileSize: 200,
          lastModified: new Date(),
        },
      ];
      const libraryId = models.musicLibrary.id('lib-1');
      const sessionId = models.session.id('session-1');
      const contextUser = makeContextUser('user-1');
      const incremental = false;

      const result = await adapter.scheduleBatchAudioScan(
        audioFiles,
        libraryId,
        sessionId,
        contextUser,
        incremental,
      );

      expect(result).toEqual({ sessionId });
      expect(scanSessionRepositoryMock.updateSession).toHaveBeenCalledTimes(1);
      expect(scanSessionRepositoryMock.updateSession).toHaveBeenCalledWith(
        sessionId,
        {
          totalBatches: 1,
          totalTracks: 2,
        },
      );
      expect(queueMock.addBulk).toHaveBeenCalledTimes(1);
      const [bulkJobs] = queueMock.addBulk.mock.calls[0];
      expect(bulkJobs).toHaveLength(1);
      expect(bulkJobs[0].name).toBe('audio-scan-batch');
      expect(bulkJobs[0].data.sessionId).toBe(sessionId);
      expect(bulkJobs[0].data.libraryId).toBe(libraryId);
      expect(bulkJobs[0].data.contextUser).toEqual(contextUser);
      expect(bulkJobs[0].data.audioFiles).toHaveLength(2);
      expect(bulkJobs[0].data.totalFiles).toBe(2);
      expect(bulkJobs[0].data.totalBatches).toBe(1);
      expect(bulkJobs[0].data.batchIndex).toBe(1);
      expect(bulkJobs[0].opts).toEqual(makeQueueConfig().queues.audioScan);
    });

    it('failure: scanSessionRepository.updateSession throws and error propagates', async () => {
      scanSessionRepositoryMock.updateSession.mockRejectedValueOnce(
        new Error('DB error'),
      );
      await expect(
        adapter.scheduleBatchAudioScan(
          [
            {
              filePath: '/a.mp3',
              fileName: 'a.mp3',
              extension: '.mp3',
              fileSize: 1,
              lastModified: new Date(),
            },
          ],
          models.musicLibrary.id('lib-1'),
          models.session.id('session-1'),
          makeContextUser('user-1'),
          false,
        ),
      ).rejects.toThrow('DB error');
      expect(queueMock.addBulk).not.toHaveBeenCalled();
    });

    it('edge case: empty audioFiles updates session with zero batches and addBulk with empty array', async () => {
      const sessionId = models.session.id('session-1');
      const result = await adapter.scheduleBatchAudioScan(
        [],
        models.musicLibrary.id('lib-1'),
        sessionId,
        makeContextUser('user-1'),
        false,
      );

      expect(result).toEqual({ sessionId });
      expect(scanSessionRepositoryMock.updateSession).toHaveBeenCalledWith(
        sessionId,
        {
          totalBatches: 0,
          totalTracks: 0,
        },
      );
      expect(queueMock.addBulk).toHaveBeenCalledWith([]);
    });
  });
});
