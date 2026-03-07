import { Test } from '@nestjs/testing';
import type { FileInfo } from 'src/application/ports/dtos/FileInfo';
import type { IAudioScanSchedulerProducer } from 'src/application/ports/infrastructure/IAudioScanSchedulerProducer';
import { AUDIO_SCAN_SCHEDULER_PRODUCER } from 'src/application/ports/infrastructure/IAudioScanSchedulerProducer';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { ScheduleBatchAudioScanUseCase } from 'src/application/use-cases/job-scheduler/ScheduleBatchAudioScan';
import type { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { models } from 'src/kernel/types/models';
import type { ActionContext } from 'src/kernel/types/model-types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeContextUser } from '../../../../_test-utils/make-context-user';

const LIBRARY_ID = models.musicLibrary.id('lib-1');
const SESSION_ID = models.session.id('session-1');
const TEST_USER_ID = 'test-user-id';

const mockUser = makeContextUser(TEST_USER_ID);
vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  getCurrentUser: vi.fn(() => mockUser),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => mockUser),
}));

function makeFileInfo(overrides: Partial<{ filePath: string; fileName: string }> = {}) {
  return {
    filePath: '/music/track.mp3',
    fileName: 'track.mp3',
    fileSize: 1024,
    extension: '.mp3',
    lastModified: new Date(),
    ...overrides,
  };
}

/** Fake producer that records calls and resolves with the given sessionId; can be set to throw once. */
class FakeAudioScanSchedulerProducer implements IAudioScanSchedulerProducer {
  readonly calls: Array<{
    audioFiles: FileInfo[];
    libraryId: MusicLibraryId;
    sessionId: SessionId;
    contextUser: ActionContext['user'];
    incremental: boolean;
  }> = [];
  private nextError: Error | null = null;

  setNextError(error: Error) {
    this.nextError = error;
  }

  async scheduleBatchAudioScan(
    audioFiles: FileInfo[],
    libraryId: MusicLibraryId,
    sessionId: SessionId,
    contextUser: ActionContext['user'],
    incremental: boolean,
  ): Promise<{ sessionId: SessionId }> {
    this.calls.push({
      audioFiles,
      libraryId,
      sessionId,
      contextUser,
      incremental,
    });
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    return { sessionId };
  }
}

describe('ScheduleBatchAudioScanUseCase', () => {
  let useCase: ScheduleBatchAudioScanUseCase;
  let fakeProducer: FakeAudioScanSchedulerProducer;

  beforeAll(async () => {
    fakeProducer = new FakeAudioScanSchedulerProducer();

    const logger: ILogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const loggerFactory = { createLogger: vi.fn(() => logger) };

    const module = await Test.createTestingModule({
      providers: [
        {
          provide: AUDIO_SCAN_SCHEDULER_PRODUCER,
          useValue: fakeProducer as IAudioScanSchedulerProducer,
        },
        { provide: LOGGER_FACTORY, useValue: loggerFactory },
        { provide: LOGGER, useValue: logger },
        {
          provide: ScheduleBatchAudioScanUseCase,
          useFactory: (
            producer: IAudioScanSchedulerProducer,
            lf: { createLogger: (name: string) => ILogger },
            log: ILogger,
          ) => new ScheduleBatchAudioScanUseCase(producer, lf, log),
          inject: [AUDIO_SCAN_SCHEDULER_PRODUCER, LOGGER_FACTORY, LOGGER],
        },
      ],
    }).compile();

    await module.init();

    useCase = module.get(ScheduleBatchAudioScanUseCase);
  });

  afterAll(async () => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    beforeEach(() => {
      fakeProducer.calls.length = 0;
    });

    it('happy path: calls producer with audio files, libraryId, sessionId, context user and incremental; returns sessionId', async () => {
      const audioFiles = [
        makeFileInfo({ filePath: '/lib/a.mp3', fileName: 'a.mp3' }),
        makeFileInfo({ filePath: '/lib/b.flac', fileName: 'b.flac' }),
      ];

      const result = await useCase.execute(audioFiles, LIBRARY_ID, SESSION_ID, false);

      expect(result).toEqual({ sessionId: SESSION_ID });
      expect(fakeProducer.calls).toHaveLength(1);
      expect(fakeProducer.calls[0]).toMatchObject({
        audioFiles,
        libraryId: LIBRARY_ID,
        sessionId: SESSION_ID,
        contextUser: expect.objectContaining({
          id: mockUser.id,
          email: 'test@test.com',
          firstName: 'Test',
          lastName: 'User',
        }),
        incremental: false,
      });
    });

    it('happy path: passes incremental true to producer', async () => {
      const audioFiles = [makeFileInfo()];

      await useCase.execute(audioFiles, LIBRARY_ID, SESSION_ID, true);

      expect(fakeProducer.calls).toHaveLength(1);
      expect(fakeProducer.calls[0]).toMatchObject({
        audioFiles,
        libraryId: LIBRARY_ID,
        sessionId: SESSION_ID,
        contextUser: expect.objectContaining({
          id: mockUser.id,
          email: 'test@test.com',
          firstName: 'Test',
          lastName: 'User',
        }),
        incremental: true,
      });
    });

    it('edge case: empty audio files array still schedules and returns sessionId', async () => {
      const result = await useCase.execute([], LIBRARY_ID, SESSION_ID, false);

      expect(result).toEqual({ sessionId: SESSION_ID });
      expect(fakeProducer.calls).toHaveLength(1);
      expect(fakeProducer.calls[0]).toMatchObject({
        audioFiles: [],
        libraryId: LIBRARY_ID,
        sessionId: SESSION_ID,
        contextUser: expect.objectContaining({
          id: mockUser.id,
          email: 'test@test.com',
          firstName: 'Test',
          lastName: 'User',
        }),
        incremental: false,
      });
    });

    it('failure: propagates when producer throws', async () => {
      fakeProducer.setNextError(new Error('Queue unavailable'));

      await expect(
        useCase.execute([makeFileInfo()], LIBRARY_ID, SESSION_ID, false),
      ).rejects.toThrow('Queue unavailable');
    });
  });
});
