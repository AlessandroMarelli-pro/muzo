import { AudioScanSchedulerConsumerAdapter } from 'src/adapters/job-schedulers/audio-scan-scheduler-consumer.adapter';
import type { AudioScanBatchJobData } from 'src/application/ports/dtos/JobSchedulersData';
import { makeContextUser } from '../../../_test-utils/make-context-user';
import { makeJob } from './_test-utils/make-job';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { models } from 'src/kernel/types/models';

const LIBRARY_ID = models.musicLibrary.id('lib-1');
const SESSION_ID = models.session.id('session-1');

function makeAudioScanBatchJobData(
  overrides: Partial<AudioScanBatchJobData> = {},
): AudioScanBatchJobData {
  return {
    audioFiles: [],
    sessionId: SESSION_ID,
    contextUser: makeContextUser('user-1'),
    startDateTS: Date.now(),
    totalFiles: 0,
    totalBatches: 1,
    batchIndex: 0,
    libraryId: LIBRARY_ID,
    incremental: false,
    ...overrides,
  };
}

describe('AudioScanSchedulerConsumerAdapter', () => {
  let adapter: AudioScanSchedulerConsumerAdapter;
  let processBatchAudioScanUseCase: { execute: ReturnType<typeof vi.fn> };
  let processSingleTrackAnalysisUseCase: { execute: ReturnType<typeof vi.fn> };
  let addImageSearchRecordUseCase: { execute: ReturnType<typeof vi.fn> };
  let processEndBatchAudioScanUseCase: { execute: ReturnType<typeof vi.fn> };
  let syncTrackToElasticSearchUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    processBatchAudioScanUseCase = {
      execute: vi.fn().mockResolvedValue({
        isBatchComplete: true,
        analysisResults: [],
        files: [],
        createdTracks: [],
      }),
    };
    processSingleTrackAnalysisUseCase = {
      execute: vi.fn().mockResolvedValue({ isSuccess: true }),
    };
    addImageSearchRecordUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    processEndBatchAudioScanUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    syncTrackToElasticSearchUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const loggerFactory = { createLogger: vi.fn(() => logger) };

    adapter = new AudioScanSchedulerConsumerAdapter(
      processBatchAudioScanUseCase as any,
      processSingleTrackAnalysisUseCase as any,
      addImageSearchRecordUseCase as any,
      processEndBatchAudioScanUseCase as any,
      syncTrackToElasticSearchUseCase as any,
      loggerFactory as any,
      logger as any,
    );
  });

  describe('process', () => {
    it('happy path: audio-scan-batch calls ProcessBatchAudioScan then ProcessEndBatchAudioScan with incremental from job data', async () => {
      const data = makeAudioScanBatchJobData({ incremental: false });
      const job = makeJob<AudioScanBatchJobData>({
        name: 'audio-scan-batch',
        data,
      });

      await adapter.process(job);

      expect(processBatchAudioScanUseCase.execute).toHaveBeenCalledTimes(1);
      expect(processBatchAudioScanUseCase.execute).toHaveBeenCalledWith(data);
      expect(processEndBatchAudioScanUseCase.execute).toHaveBeenCalledTimes(1);
      expect(processEndBatchAudioScanUseCase.execute).toHaveBeenCalledWith(
        data,
        data.libraryId,
        false,
        data.contextUser,
      );
    });

    it('happy path: ProcessEndBatchAudioScan receives incremental true when job data has incremental true', async () => {
      const data = makeAudioScanBatchJobData({ incremental: true });
      const job = makeJob<AudioScanBatchJobData>({
        name: 'audio-scan-batch',
        data,
      });

      await adapter.process(job);

      expect(processEndBatchAudioScanUseCase.execute).toHaveBeenCalledTimes(1);
      expect(processEndBatchAudioScanUseCase.execute).toHaveBeenCalledWith(
        data,
        data.libraryId,
        true,
        data.contextUser,
      );
    });

    it('failure: use case throws and error propagates', async () => {
      processBatchAudioScanUseCase.execute.mockRejectedValueOnce(new Error('Batch failed'));
      const job = makeJob<AudioScanBatchJobData>({
        name: 'audio-scan-batch',
        data: makeAudioScanBatchJobData(),
      });

      await expect(adapter.process(job)).rejects.toThrow('Batch failed');
    });

    it('edge case: unknown job name throws', async () => {
      const job = makeJob<AudioScanBatchJobData>({
        name: 'unknown-job',
        data: makeAudioScanBatchJobData(),
      });

      await expect(adapter.process(job)).rejects.toThrow('Unknown job name: unknown-job');
    });
  });
});
