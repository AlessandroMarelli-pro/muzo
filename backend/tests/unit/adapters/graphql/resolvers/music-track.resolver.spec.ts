import { MusicTrackResolver } from 'src/adapters/graphql/resolvers/music-track.resolver';
import { ScheduleSingleTrackScanUseCase } from 'src/application/use-cases';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('MusicTrackResolver', () => {
  let resolver: MusicTrackResolver;
  let scheduleSingleTrackScanUseCase: { execute: ReturnType<typeof vi.fn> };

  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    scheduleSingleTrackScanUseCase = {
      execute: vi.fn().mockResolvedValue({ sessionId: 'session-123' }),
    };
    resolver = new MusicTrackResolver(
      { execute: vi.fn() } as any,
      scheduleSingleTrackScanUseCase as unknown as ScheduleSingleTrackScanUseCase,
      { execute: vi.fn() } as any,
      { execute: vi.fn() } as any,
      { execute: vi.fn() } as any,
      { execute: vi.fn() } as any,
    );
  });

  describe('scanTrack', () => {
    it('happy path: calls use case with decoded trackId and force, returns sessionId', async () => {
      const trackId = 'MusicTrack:track-uuid-1';
      const force = false;

      const result = await resolver.scanTrack(trackId, force);

      expect(scheduleSingleTrackScanUseCase.execute).toHaveBeenCalledTimes(1);
      expect(scheduleSingleTrackScanUseCase.execute).toHaveBeenCalledWith(trackId, false);
      expect(result).toBe('session-123');
    });

    it('happy path: passes force true to use case', async () => {
      const trackId = 'MusicTrack:track-uuid-2';

      await resolver.scanTrack(trackId, true);

      expect(scheduleSingleTrackScanUseCase.execute).toHaveBeenCalledWith(trackId, true);
    });

    it('when force is undefined, passes false to use case', async () => {
      const trackId = 'MusicTrack:track-uuid-3';

      await resolver.scanTrack(trackId, undefined);

      expect(scheduleSingleTrackScanUseCase.execute).toHaveBeenCalledWith(trackId, false);
    });

    it('failure: propagates when use case throws', async () => {
      scheduleSingleTrackScanUseCase.execute.mockRejectedValueOnce(new Error('Track not found'));

      await expect(
        resolver.scanTrack('MusicTrack:missing', false),
      ).rejects.toThrow('Track not found');
    });
  });
});
