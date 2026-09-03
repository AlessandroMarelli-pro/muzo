/**
 * Pure ETA estimator for a running scan session.
 *
 * Uses session-wide average throughput (processed tracks / elapsed time) rather than a
 * sliding window: batches are fixed-size (10 files, see audio-scan-scheduler-producer.adapter.ts)
 * and processed roughly homogeneously, so the running average is naturally self-smoothing.
 * A windowed/instantaneous rate would swing wildly on a single slow file (e.g. a long FLAC
 * or an M4A that needs conversion).
 */

export type EtaConfidence = 'warming-up' | 'low' | 'medium' | 'high';

export interface EstimateCompletionInput {
  startedAt: Date;
  completedTracks: number;
  failedTracks: number;
  totalTracks: number;
}

export interface EstimateCompletionResult {
  /** Seconds until completion at the current average rate, rounded to a human bucket. Null
   * when there isn't enough signal yet (see MIN_PROCESSED_FOR_ESTIMATE / MIN_ELAPSED_MS_FOR_ESTIMATE)
   * or the scan has nothing left to estimate. */
  etaSeconds: number | null;
  /** Session-wide average tracks processed per second. Null under the same conditions as etaSeconds. */
  tracksPerSecond: number | null;
  /** How much to trust etaSeconds -- 'warming-up' means don't show a number at all. */
  confidence: EtaConfidence;
  elapsedSeconds: number;
}

// Below this many processed tracks, an average rate is mostly noise (e.g. one lucky-fast
// file makes the ETA swing wildly).
const MIN_PROCESSED_FOR_ESTIMATE = 5;
// Below this much elapsed time, even a handful of fast small files can imply an absurd rate.
const MIN_ELAPSED_MS_FOR_ESTIMATE = 10_000;
// Sanity ceiling so a near-zero rate (e.g. one file stuck retrying) doesn't render "3 days left".
const MAX_ETA_SECONDS = 24 * 60 * 60;

const roundToHumanBucket = (seconds: number): number => {
  if (seconds < 60) {
    // Nearest 5s under a minute.
    return Math.max(5, Math.round(seconds / 5) * 5);
  }
  // Nearest minute above a minute.
  return Math.round(seconds / 60) * 60;
};

const confidenceFor = (processed: number, totalTracks: number): EtaConfidence => {
  const fraction = totalTracks > 0 ? processed / totalTracks : 0;
  if (fraction >= 0.5) return 'high';
  if (fraction >= 0.15) return 'medium';
  return 'low';
};

export const estimateCompletion = (
  session: EstimateCompletionInput,
  now: Date = new Date(),
): EstimateCompletionResult => {
  const processed = session.completedTracks + session.failedTracks;
  const elapsedMs = now.getTime() - session.startedAt.getTime();
  const elapsedSeconds = Math.max(0, Math.round(elapsedMs / 1000));

  const notEnoughSignal =
    processed < MIN_PROCESSED_FOR_ESTIMATE || elapsedMs < MIN_ELAPSED_MS_FOR_ESTIMATE;
  const nothingLeftToEstimate = session.totalTracks === 0 || processed >= session.totalTracks;

  if (notEnoughSignal || nothingLeftToEstimate) {
    return {
      etaSeconds: null,
      tracksPerSecond: null,
      confidence: notEnoughSignal ? 'warming-up' : confidenceFor(processed, session.totalTracks),
      elapsedSeconds,
    };
  }

  const tracksPerSecond = processed / (elapsedMs / 1000);
  const remaining = session.totalTracks - processed;
  const rawEtaSeconds = tracksPerSecond > 0 ? remaining / tracksPerSecond : null;

  const etaSeconds =
    rawEtaSeconds === null
      ? null
      : roundToHumanBucket(Math.min(rawEtaSeconds, MAX_ETA_SECONDS));

  return {
    etaSeconds,
    tracksPerSecond,
    confidence: confidenceFor(processed, session.totalTracks),
    elapsedSeconds,
  };
};
