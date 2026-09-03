import { Observable } from 'rxjs';
import { SessionId } from 'src/kernel/ids';
import { createToken } from '../../utils/create-token';
import { ScanErrorEvent, ScanProgressEvent } from '../dtos/ScanProgress.types';

export const SCAN_PROGRESS_SUBSCRIBER = createToken<IScanProgressSubscriber>(
  'SCAN_PROGRESS_SUBSCRIBER',
);

export interface IScanProgressSubscriber {
  subscribeToSession(sessionId: SessionId): Promise<void>;
  unsubscribeFromSession(sessionId: SessionId): Promise<void>;
  getEventStream(sessionId: SessionId): Observable<ScanProgressEvent>;
  getErrorStream(sessionId: SessionId): Observable<ScanErrorEvent>;
}
