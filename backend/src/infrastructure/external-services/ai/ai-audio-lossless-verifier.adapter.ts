import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import FormData from 'form-data';
import fs from 'fs';
import { firstValueFrom } from 'rxjs';
import {
  AI_SERVICE_POOL,
  IAiServicePool,
} from 'src/application/ports/infrastructure/IAiServicePool';
import {
  HqAudioVerificationResult,
  IHqAudioVerifier,
} from 'src/application/ports/infrastructure/IHqAudioVerifier';

type VerifyLosslessResponse = {
  status: string;
  verified: boolean;
  cutoff_hz: number | null;
  sample_rate: number;
  reason: string;
};

@Injectable()
export class AiAudioLosslessVerifierAdapter implements IHqAudioVerifier {
  private readonly logger = new Logger(AiAudioLosslessVerifierAdapter.name);

  constructor(
    @Inject(AI_SERVICE_POOL)
    private readonly aiServicePool: IAiServicePool,
    private readonly httpService: HttpService,
  ) {}

  async verify(filePath: string): Promise<HqAudioVerificationResult> {
    const target = this.aiServicePool.getTarget();

    const formData = new FormData();
    formData.append('audio_file', fs.createReadStream(filePath));

    const response = await firstValueFrom(
      this.httpService.post<VerifyLosslessResponse>(
        `${target.url}/api/v1/audio/verify-lossless`,
        formData,
        {
          headers: { ...formData.getHeaders(), ...target.headers },
          timeout: 120_000,
        },
      ),
    );

    const data = response.data;
    this.logger.debug(
      `verify-lossless ${filePath}: verified=${data.verified} cutoff=${data.cutoff_hz}Hz (${data.reason})`,
    );
    return {
      verified: data.verified,
      cutoffHz: data.cutoff_hz,
      reason: data.reason,
    };
  }
}
