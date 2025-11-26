import { IntelligentEditorSession, SessionStatus } from '@prisma/client';

export { IntelligentEditorSession, SessionStatus };

export interface CreateIntelligentEditorSessionDto {
  trackId: string;
  userId?: string;
  suggestions: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    confidence?: number;
  };
  confidenceThreshold?: number;
}

export interface UpdateIntelligentEditorSessionDto {
  sessionStatus?: SessionStatus;
  userActions?: Array<{
    field: string;
    action: 'accept' | 'modify' | 'reject';
    value?: string;
    timestamp: Date;
  }>;
  sessionDuration?: number;
}

export interface IntelligentEditorSessionWithRelations
  extends IntelligentEditorSession {
  track: {
    id: string;
    fileName: string;
    originalTitle?: string;
    originalArtist?: string;
    originalAlbum?: string;
    originalGenre?: string;
  };
}

export interface UserAction {
  field: string;
  action: 'accept' | 'modify' | 'reject';
  value?: string;
  timestamp: Date;
}

export interface SessionSuggestions {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  confidence?: number;
}

export interface IntelligentEditorSessionQueryOptions {
  trackId?: string;
  userId?: string;
  sessionStatus?: SessionStatus;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'sessionDuration';
  orderDirection?: 'asc' | 'desc';
}
