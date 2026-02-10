import { SessionId } from 'src/clean-arch/kernel/ids';
import { createToken } from '../../utils/create-token';
import { ScanErrorEvent, ScanProgressEvent } from '../dtos/ScanProgress.types';

export const SCAN_PROGRESS_PUBLISHER = createToken<IScanProgressPublisher>(
  'SCAN_PROGRESS_PUBLISHED',
);

export interface IScanProgressPublisher {
  publishEvent(sessionId: SessionId, event: ScanProgressEvent): Promise<void>;
  publishError(sessionId: SessionId, error: ScanErrorEvent): Promise<void>;
}
