import { LibraryScanSchedulerConsumerAdapter } from 'src/adapters/job-schedulers/library-scan-scheduler-consumer.adapter';
import type {
  EndLibraryScanJobData,
  LibraryScanJobData,
} from 'src/application/ports/dtos/JobSchedulersData';
import { makeContextUser } from '../../../_test-utils/make-context-user';
import { makeJob } from './_test-utils/make-job';

describe('LibraryScanSchedulerConsumerAdapter', () => {
  let adapter: LibraryScanSchedulerConsumerAdapter;
  let processStartLibraryScanUseCase: { execute: ReturnType<typeof vi.fn> };
  let scheduleBatchAudioScanUseCase: { execute: ReturnType<typeof vi.fn> };
  let processEndLibraryScanUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    processStartLibraryScanUseCase = { execute: vi.fn().mockResolvedValue([]) };
    scheduleBatchAudioScanUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    processEndLibraryScanUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    adapter = new LibraryScanSchedulerConsumerAdapter(
      processStartLibraryScanUseCase as any,
      scheduleBatchAudioScanUseCase as any,
      processEndLibraryScanUseCase as any,
    );
  });

  describe('process', () => {
    it('happy path: start-library-scan calls ProcessStartLibraryScan and ScheduleBatchAudioScan', async () => {
      const libraryId = 'lib-1' as const;
      const sessionId = 'session-1' as const;
      const incremental = false;
      const contextUser = makeContextUser('user-1');
      const audioFiles = [
        {
          path: '/music/track.mp3',
          filename: 'track.mp3',
          extension: '.mp3',
          size: 1024,
        },
      ];
      processStartLibraryScanUseCase.execute.mockResolvedValueOnce(audioFiles);

      const job = makeJob<LibraryScanJobData>({
        name: 'start-library-scan',
        data: { libraryId, sessionId, incremental, contextUser },
      });

      await adapter.process(job);

      expect(processStartLibraryScanUseCase.execute).toHaveBeenCalledTimes(1);
      expect(processStartLibraryScanUseCase.execute).toHaveBeenCalledWith(libraryId, incremental);
      expect(scheduleBatchAudioScanUseCase.execute).toHaveBeenCalledTimes(1);
      expect(scheduleBatchAudioScanUseCase.execute).toHaveBeenCalledWith(
        audioFiles,
        libraryId,
        sessionId,
        incremental,
        undefined,
        undefined,
      );
      expect(job.updateProgress).toHaveBeenCalledWith(0);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('happy path: force flag from job data propagates to ScheduleBatchAudioScan', async () => {
      const libraryId = 'lib-1' as const;
      const sessionId = 'session-1' as const;
      const incremental = false;
      const contextUser = makeContextUser('user-1');
      const audioFiles = [
        {
          path: '/music/track.mp3',
          filename: 'track.mp3',
          extension: '.mp3',
          size: 1024,
        },
      ];
      processStartLibraryScanUseCase.execute.mockResolvedValueOnce(audioFiles);

      const job = makeJob<LibraryScanJobData>({
        name: 'start-library-scan',
        data: { libraryId, sessionId, incremental, contextUser, force: true },
      });

      await adapter.process(job);

      expect(scheduleBatchAudioScanUseCase.execute).toHaveBeenCalledWith(
        audioFiles,
        libraryId,
        sessionId,
        incremental,
        true,
        undefined,
      );
    });

    it('happy path: skipAiMetadata flag from job data propagates to ScheduleBatchAudioScan', async () => {
      const libraryId = 'lib-1' as const;
      const sessionId = 'session-1' as const;
      const incremental = false;
      const contextUser = makeContextUser('user-1');
      const audioFiles = [
        {
          path: '/music/track.mp3',
          filename: 'track.mp3',
          extension: '.mp3',
          size: 1024,
        },
      ];
      processStartLibraryScanUseCase.execute.mockResolvedValueOnce(audioFiles);

      const job = makeJob<LibraryScanJobData>({
        name: 'start-library-scan',
        data: {
          libraryId,
          sessionId,
          incremental,
          contextUser,
          force: true,
          skipAiMetadata: true,
        },
      });

      await adapter.process(job);

      expect(scheduleBatchAudioScanUseCase.execute).toHaveBeenCalledWith(
        audioFiles,
        libraryId,
        sessionId,
        incremental,
        true,
        true,
      );
    });

    it('happy path: start-library-scan with no files calls ProcessEndLibraryScan and not ScheduleBatchAudioScan', async () => {
      const libraryId = 'lib-1' as const;
      const sessionId = 'session-1' as const;
      const incremental = true;
      const contextUser = makeContextUser('user-1');
      processStartLibraryScanUseCase.execute.mockResolvedValueOnce([]);

      const job = makeJob<LibraryScanJobData>({
        name: 'start-library-scan',
        data: { libraryId, sessionId, incremental, contextUser },
      });

      await adapter.process(job);

      expect(processStartLibraryScanUseCase.execute).toHaveBeenCalledTimes(1);
      expect(processStartLibraryScanUseCase.execute).toHaveBeenCalledWith(libraryId, incremental);
      expect(processEndLibraryScanUseCase.execute).toHaveBeenCalledTimes(1);
      expect(processEndLibraryScanUseCase.execute).toHaveBeenCalledWith(
        libraryId,
        sessionId,
        incremental,
      );
      expect(scheduleBatchAudioScanUseCase.execute).not.toHaveBeenCalled();
      expect(job.updateProgress).toHaveBeenCalledWith(0);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('happy path: end-scan-library calls ProcessEndLibraryScan', async () => {
      const libraryId = 'lib-1' as const;
      const sessionId = 'session-1' as const;
      const incremental = true;
      const contextUser = makeContextUser('user-1');
      const job = makeJob<EndLibraryScanJobData>({
        name: 'end-scan-library',
        data: { libraryId, sessionId, incremental, contextUser },
      });

      await adapter.process(job);

      expect(processEndLibraryScanUseCase.execute).toHaveBeenCalledTimes(1);
      expect(processEndLibraryScanUseCase.execute).toHaveBeenCalledWith(
        libraryId,
        sessionId,
        incremental,
      );
      expect(processStartLibraryScanUseCase.execute).not.toHaveBeenCalled();
      expect(scheduleBatchAudioScanUseCase.execute).not.toHaveBeenCalled();
    });

    it('failure: use case throws and error propagates', async () => {
      processStartLibraryScanUseCase.execute.mockRejectedValueOnce(new Error('Scan failed'));
      const job = makeJob<LibraryScanJobData>({
        name: 'start-library-scan',
        data: {
          libraryId: 'lib-1',
          sessionId: 'session-1',
          incremental: false,
          contextUser: makeContextUser('user-1'),
        },
      });

      await expect(adapter.process(job)).rejects.toThrow('Scan failed');
    });

    it('edge case: unknown job name throws', async () => {
      const job = makeJob<LibraryScanJobData>({
        name: 'unknown-job',
        data: {
          libraryId: 'lib-1',
          sessionId: 'session-1',
          incremental: false,
          contextUser: makeContextUser('user-1'),
        },
      });

      await expect(adapter.process(job)).rejects.toThrow('Unknown job name: unknown-job');
    });
  });
});
