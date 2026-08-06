import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import {
  HqAudioAcquireResult,
  IHqAudioAcquirer,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';

type SockseekTrackStateEvent = {
  type: 'track_state';
  data: {
    terminalOutcome?: string;
    skipReason?: string;
    failureReason?: string;
    downloadPath?: string;
    extension?: string;
  };
};

@Injectable()
export class SockseekAcquirer implements IHqAudioAcquirer {
  private readonly binaryPath: string;
  private readonly configPath: string;
  private readonly timeoutMs: number;
  private readonly defaultOutputDir: string;
  private readonly logger: ILogger;

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('SockseekAcquirer');
    this.binaryPath = this.configService.get<string>('hqAudio.sockseek.binaryPath') ?? 'sockseek';
    this.configPath = this.configService.get<string>('hqAudio.sockseek.configPath') ?? '';
    this.timeoutMs = this.configService.get<number>('hqAudio.sockseek.timeoutMs') ?? 120000;
    this.defaultOutputDir = this.configService.get<string>('hqAudio.sockseek.outputDir') ?? '';
  }

  private parseTrackStateLine(line: string): SockseekTrackStateEvent | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.type === 'track_state') {
        return parsed as SockseekTrackStateEvent;
      }
      return null;
    } catch {
      return null;
    }
  }

  async acquire(
    artist: string,
    title: string,
    _durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    const resolvedOutputDir = outputDir || this.defaultOutputDir;
    await fs.mkdir(resolvedOutputDir, { recursive: true });

    const args = [
      `${artist} - ${title}`,
      '-s',
      '--progress-json',
      '-p',
      resolvedOutputDir,
      '--pref-format',
      'flac,wav',
      '--fast-search',
    ];
    if (this.configPath) {
      args.push('--config', this.configPath);
    }

    const holder: { finalState: SockseekTrackStateEvent['data'] | null } = { finalState: null };
    let stdoutBuffer = '';
    let stderr = '';

    await new Promise<void>((resolve, reject) => {
      const cmd = spawn(this.binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const timer = setTimeout(() => {
        cmd.kill('SIGTERM');
        reject(new Error(`sockseek timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      cmd.stdout.on('data', (chunk) => {
        stdoutBuffer += String(chunk);
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() ?? '';
        for (const line of lines) {
          const event = this.parseTrackStateLine(line);
          if (event) {
            holder.finalState = event.data;
          }
        }
      });
      cmd.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      cmd.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      cmd.on('close', () => {
        clearTimeout(timer);
        const event = this.parseTrackStateLine(stdoutBuffer);
        if (event) {
          holder.finalState = event.data;
        }
        resolve();
      });
    });

    const finalState = holder.finalState;
    if (!finalState) {
      this.logger.warn('sockseek produced no track_state event', { artist, title, stderr });
      return null;
    }

    if (finalState.terminalOutcome !== 'Succeeded' || !finalState.downloadPath) {
      this.logger.warn('sockseek did not find a match', {
        artist,
        title,
        terminalOutcome: finalState.terminalOutcome,
        skipReason: finalState.skipReason,
        failureReason: finalState.failureReason,
      });
      return null;
    }

    const format = finalState.extension === 'wav' ? 'wav' : 'flac';
    return {
      filePath: finalState.downloadPath,
      format,
    };
  }
}
