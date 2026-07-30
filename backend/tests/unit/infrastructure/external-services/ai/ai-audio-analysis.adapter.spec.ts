import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';
import { of } from 'rxjs';
import { IAiServicePool } from 'src/application/ports/infrastructure/IAiServicePool';
import { AiAudioAnalysisAdapter } from 'src/infrastructure/external-services/ai/ai-audio-analysis.adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('AiAudioAnalysisAdapter', () => {
  let adapter: AiAudioAnalysisAdapter;
  let httpService: { post: ReturnType<typeof vi.fn> };
  let aiServicePool: IAiServicePool;
  let appendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // form-data's real append() rejects a bare string path as file content, and buffering
    // the resulting stream to inspect it is brittle -- spy on append() instead to assert
    // which fields get written, without caring how the multipart body is serialized.
    appendSpy = vi.spyOn(FormData.prototype, 'append');

    httpService = {
      post: vi.fn().mockReturnValue(
        of({
          data: { total_files: 0, successful: 0, failed: 0, results: [] },
        }),
      ),
    };
    aiServicePool = {
      getAssignedServer: vi.fn().mockReturnValue({
        backendPort: 5000,
        url: 'http://localhost:5000',
        isHealthy: true,
        lastChecked: new Date(),
        activeConnections: 0,
      }),
      getHealthInfo: vi.fn(),
    };
    const configService = {
      get: vi.fn().mockReturnValue({ timeout: 90000 }),
    } as unknown as ConfigService;

    adapter = new AiAudioAnalysisAdapter(
      aiServicePool,
      httpService as unknown as HttpService,
      configService,
    );
  });

  afterEach(() => {
    appendSpy.mockRestore();
  });

  function appendedFieldValues(field: string): unknown[] {
    return appendSpy.mock.calls.filter(([name]) => name === field).map(([, value]) => value);
  }

  it('appends skip_ai_metadata=true when skipAiMetadata is true', async () => {
    await adapter.analyzeAudioBatch(['/music/track1.mp3'], undefined, undefined, undefined, true);

    expect(appendedFieldValues('skip_ai_metadata')).toEqual(['true']);
  });

  it('does not append skip_ai_metadata when skipAiMetadata is false or omitted', async () => {
    await adapter.analyzeAudioBatch(['/music/track1.mp3']);

    expect(appendedFieldValues('skip_ai_metadata')).toEqual([]);
  });

  it('still appends has_image when skipImageSearch is true, independent of skipAiMetadata', async () => {
    await adapter.analyzeAudioBatch(['/music/track1.mp3'], undefined, undefined, true, true);

    expect(appendedFieldValues('has_image')).toEqual(['true']);
    expect(appendedFieldValues('skip_ai_metadata')).toEqual(['true']);
  });
});
