import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import { ActionContext } from 'src/clean-arch/kernel/types';

export interface LibraryScanJobData {
  libraryId: MusicLibraryId;
  sessionId?: string; // Optional for backward compatibility
  incremental: boolean;
  contextUser: ActionContext['user'];
}
