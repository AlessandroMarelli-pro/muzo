import { createToken } from '../../utils/create-token';

export type HqAudioVerificationResult = {
  /** True when the file's spectrum is consistent with genuine lossless. */
  verified: boolean;
  /** Estimated high-frequency cutoff in Hz, or null if it could not be measured. */
  cutoffHz: number | null;
  /** Human-readable explanation of the verdict. */
  reason: string;
};

export const HQ_AUDIO_VERIFIER = createToken<IHqAudioVerifier>('HQ_AUDIO_VERIFIER');

export interface IHqAudioVerifier {
  /**
   * Spectral fake-lossless check on a lossless-container file. Returns a verdict
   * rather than throwing on a "fake" file; only infrastructure failures throw.
   */
  verify(filePath: string): Promise<HqAudioVerificationResult>;
}
