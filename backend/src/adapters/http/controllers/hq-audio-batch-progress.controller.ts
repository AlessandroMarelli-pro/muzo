import { Controller, Param, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { HqAudioBatchProgressEvent } from 'src/application/ports/dtos/HqAudioBatchProgress.types';
import { StreamHqAudioBatchProgressUseCase } from 'src/application/use-cases/hq-audio-batch/StreamHqAudioBatchProgress';
import { HqAudioBatchId } from 'src/kernel/ids';
import { fromBase64Id } from '../../common/utils/id-encoding';

@Controller('hq-audio-batch-progress')
export class HqAudioBatchProgressController {
  constructor(private readonly streamHqAudioBatchProgressUseCase: StreamHqAudioBatchProgressUseCase) {}

  /**
   * SSE endpoint for HQ audio batch download progress
   * GET /hq-audio-batch-progress/:batchId
   */
  @Sse(':batchId')
  async streamProgress(
    @Param('batchId') batchId: string,
  ): Promise<Observable<{ data: HqAudioBatchProgressEvent }>> {
    return this.streamHqAudioBatchProgressUseCase.execute(fromBase64Id(batchId) as HqAudioBatchId);
  }
}
