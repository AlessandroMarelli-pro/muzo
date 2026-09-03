import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import {
  HqAudioAcquireResult,
  IHqAudioAcquirer,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import {
  HQ_AUDIO_VERIFIER,
  IHqAudioVerifier,
} from 'src/application/ports/infrastructure/IHqAudioVerifier';
import { HqAudioSource } from 'src/kernel/types/model-types';
import { probeAudioCodec } from './audio-probe';
import { DeezerAcquirer } from './deezer.acquirer';
import { QobuzAcquirer } from './qobuz.acquirer';
import { SockseekAcquirer } from './sockseek.acquirer';
import { TidalDlAcquirer } from './tidal-dl.acquirer';

/** Formats whose spectrum is worth checking for a lossy-transcode shelf. */
const VERIFIABLE_FORMATS: ReadonlySet<HqAudioAcquireResult['format']> = new Set([
  'flac',
  'wav',
  'aiff',
  'aif',
]);

/**
 * Tries each configured source in `hqAudio.sourceOrder` until one returns a
 * file. A source named in the order but not registered (e.g. Qobuz before its
 * acquirer is wired) is skipped; a source that throws is logged and the cascade
 * continues.
 *
 * Every returned file is codec-probed first: a lossy codec (AAC/MP3/…, e.g.
 * Tidal without a HiFi entitlement) does not count as lossless — the cascade
 * moves on, keeping that file only as a last-resort fallback. A lossless file
 * then goes through the spectral `verifyLossless` check. If nothing lossless is
 * found, the best lossy fallback is returned marked `verified: false`.
 */
@Injectable()
export class CompositeHqAudioAcquirer implements IHqAudioAcquirer {
  private readonly registry: Partial<Record<HqAudioSource, IHqAudioAcquirer>>;

  constructor(
    private readonly tidalDlAcquirer: TidalDlAcquirer,
    private readonly qobuzAcquirer: QobuzAcquirer,
    private readonly deezerAcquirer: DeezerAcquirer,
    private readonly sockseekAcquirer: SockseekAcquirer,
    private readonly configService: ConfigService,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
    @Optional()
    @Inject(HQ_AUDIO_VERIFIER)
    private readonly verifier?: IHqAudioVerifier,
  ) {
    this.logger = loggerFactory.createLogger('CompositeHqAudioAcquirer');
    // New sources (bandcamp, ...) register here as their acquirers land.
    this.registry = {
      tidal: this.tidalDlAcquirer,
      qobuz: this.qobuzAcquirer,
      deezer: this.deezerAcquirer,
      soulseek: this.sockseekAcquirer,
    };
  }

  private resolveOrder(): HqAudioSource[] {
    const configured = this.configService.get<string[]>('hqAudio.sourceOrder') ?? [
      'tidal',
      'soulseek',
    ];
    let order = configured.filter((name): name is HqAudioSource => name in this.registry);

    // Soulseek can't guarantee hi-res: on the 'hires' tier, drop it to last so
    // the streaming sources get first crack at a 24-bit copy.
    if (this.configService.get<string>('hqAudio.qualityTier') === 'hires') {
      order = [...order.filter((s) => s !== 'soulseek'), ...order.filter((s) => s === 'soulseek')];
    }
    return order;
  }

  private verificationEnabled(): boolean {
    return !!this.verifier && this.configService.get<boolean>('hqAudio.verifyLossless') !== false;
  }

  async acquire(
    artist: string,
    title: string,
    durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    const order = this.resolveOrder();
    if (order.length === 0) {
      this.logger.warn('No HQ audio sources are enabled', { artist, title });
      return null;
    }

    const verify = this.verificationEnabled();
    // A lossy-codec file (e.g. Tidal AAC) kept in case nothing lossless is
    // found. Not unlinked — it's a real, usable upgrade for some originals.
    let lossyFallback: HqAudioAcquireResult | null = null;

    for (const source of order) {
      const acquirer = this.registry[source];
      if (!acquirer) {
        continue;
      }

      let result: HqAudioAcquireResult | null;
      try {
        result = await acquirer.acquire(artist, title, durationSeconds, outputDir);
      } catch (error) {
        this.logger.warn('HQ source failed, trying next', {
          artist,
          title,
          source,
          error: String(error),
        });
        continue;
      }

      if (!result) {
        this.logger.info('HQ source found no match, trying next', { artist, title, source });
        continue;
      }

      const stamped: HqAudioAcquireResult = { ...result, source: result.source ?? source };

      // Codec guard: the container extension is not trustworthy (Tidal ships
      // 320k AAC as .m4a). Probe the real codec.
      const probed = await probeAudioCodec(stamped.filePath);
      if (probed && !probed.lossless) {
        this.logger.warn('HQ source returned a lossy codec, keeping only as fallback', {
          artist,
          title,
          source: stamped.source,
          codec: probed.codec,
          filePath: stamped.filePath,
        });
        if (!lossyFallback) {
          lossyFallback = { ...stamped, verified: false, spectralCutoffHz: null };
        }
        continue;
      }

      if (!verify || !VERIFIABLE_FORMATS.has(stamped.format)) {
        this.logger.info('HQ acquisition succeeded', {
          artist,
          title,
          source: stamped.source,
          filePath: stamped.filePath,
          codec: probed?.codec ?? 'unknown',
        });
        return { ...stamped, verified: probed?.lossless ? true : undefined };
      }

      const verdict = await this.runVerification(stamped, artist, title);
      if (verdict.outcome === 'pass') {
        this.logger.info('HQ acquisition succeeded and verified', {
          artist,
          title,
          source: stamped.source,
          filePath: stamped.filePath,
          cutoffHz: verdict.spectralCutoffHz,
        });
        return { ...stamped, verified: true, spectralCutoffHz: verdict.spectralCutoffHz };
      }
      if (verdict.outcome === 'skipped') {
        // Verifier unavailable — accept the file but leave it unverified so a
        // later scan can re-check it.
        return { ...stamped, verified: false, spectralCutoffHz: null };
      }

      // A FLAC that's really a transcode-from-lossy is worthless — discard it
      // outright (unlike a genuine lossy file, which we keep as a fallback).
      this.logger.warn('HQ file failed spectral verification, discarding and trying next', {
        artist,
        title,
        source: stamped.source,
        filePath: stamped.filePath,
        cutoffHz: verdict.spectralCutoffHz,
      });
      await fs.unlink(stamped.filePath).catch(() => undefined);
    }

    if (lossyFallback) {
      this.logger.warn('No lossless HQ source; returning lossy fallback (verified: false)', {
        artist,
        title,
        source: lossyFallback.source,
        filePath: lossyFallback.filePath,
      });
      return lossyFallback;
    }

    this.logger.warn('No HQ audio source produced a file', { artist, title });
    return null;
  }

  private async runVerification(
    result: HqAudioAcquireResult,
    artist: string,
    title: string,
  ): Promise<{ outcome: 'pass' | 'fail' | 'skipped'; spectralCutoffHz: number | null }> {
    try {
      const v = await this.verifier!.verify(result.filePath);
      return { outcome: v.verified ? 'pass' : 'fail', spectralCutoffHz: v.cutoffHz };
    } catch (error) {
      this.logger.warn('Spectral verification errored, accepting file unverified', {
        artist,
        title,
        filePath: result.filePath,
        error: String(error),
      });
      return { outcome: 'skipped', spectralCutoffHz: null };
    }
  }
}
