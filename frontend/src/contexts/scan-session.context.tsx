/**
 * Context for managing active scan sessions
 * Tracks sessionIds for libraries being scanned
 * Automatically fetches active sessions from the database on mount
 */

import { useActiveScanSessions } from '@/services/rest-client';
import sseService from '@/services/sse-service';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface ScanSession {
  sessionId: string;
  libraryId?: string;
  startedAt: string;
  status?: string;
  totalTracks: number;
  completedTracks: number;
  failedTracks: number;

}

interface ScanSessionContextType {
  activeSessions: Map<string, ScanSession>; // sessionId -> session
  addSession: (sessionId: string, libraryId?: string) => void;
  removeSession: (sessionId: string) => void;
  getSessionForLibrary: (libraryId: string) => ScanSession | undefined;
  isLoading: boolean;
}

const ScanSessionContext = createContext<ScanSessionContextType | undefined>(
  undefined,
);

export const ScanSessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeSessions, setActiveSessions] = useState<
    Map<string, ScanSession>
  >(new Map());
  const { data: activeSessionsFromDB, isLoading } = useActiveScanSessions();

  // Load active sessions from database on mount and when they change
  useEffect(() => {
    if (activeSessionsFromDB && activeSessionsFromDB.length > 0) {
      setActiveSessions((prev) => {
        const newMap = new Map(prev);

        // Add all active sessions from database
        activeSessionsFromDB.forEach((session) => {
          const scanSession: ScanSession = {
            sessionId: session.sessionId,
            startedAt: session.startedAt,
            status: session.status,
            totalTracks: session.totalTracks,
            completedTracks: session.completedTracks,
            failedTracks: session.failedTracks,
          };
          newMap.set(session.sessionId, scanSession);

          // Automatically connect to SSE for this session
          if (!sseService.isConnected(session.sessionId)) {
            sseService.connect(session.sessionId);
          }
        });

        return newMap;
      });
    }
  }, [activeSessionsFromDB]);

  const addSession = (sessionId: string, libraryId?: string) => {
    setActiveSessions((prev) => {
      const newMap = new Map(prev);
      const session: ScanSession = {
        sessionId,
        libraryId,
        startedAt: new Date().toISOString(),
        totalTracks: 0,
        completedTracks: 0,
        failedTracks: 0,
      };
      // Store by sessionId
      newMap.set(sessionId, session);

      // Also store by libraryId if provided
      if (libraryId) {
        // Find existing session for this library and remove it
        for (const [key, value] of newMap.entries()) {
          if (value.libraryId === libraryId && value.sessionId !== sessionId) {
            newMap.delete(key);
          }
        }
        newMap.set(libraryId, session);
      }

      // Connect to SSE
      if (!sseService.isConnected(sessionId)) {
        sseService.connect(sessionId);
      }

      return newMap;
    });
  };

  const removeSession = (sessionId: string) => {
    setActiveSessions((prev) => {
      const newMap = new Map(prev);
      const session = newMap.get(sessionId);
      if (session?.libraryId) {
        newMap.delete(session.libraryId);
      }
      newMap.delete(sessionId);

      // Disconnect from SSE
      sseService.disconnect(sessionId);

      return newMap;
    });
  };

  const getSessionForLibrary = (libraryId: string): ScanSession | undefined => {
    // First try to find by libraryId
    const sessionByLibrary = activeSessions.get(libraryId);
    if (sessionByLibrary) {
      return sessionByLibrary;
    }

    // If not found, search through all sessions
    for (const session of activeSessions.values()) {
      if (session.libraryId === libraryId) {
        return session;
      }
    }

    return undefined;
  };

  // Clean up completed sessions
  useEffect(() => {
    const checkCompletedSessions = () => {
      setActiveSessions((prev) => {
        const newMap = new Map(prev);
        let changed = false;

        prev.forEach((session, key) => {
          // Remove if status is IDLE or ERROR (completed)
          if (session.status === 'IDLE' || session.status === 'ERROR') {
            newMap.delete(key);
            if (session.libraryId) {
              newMap.delete(session.libraryId);
            }
            sseService.disconnect(session.sessionId);
            changed = true;
          }
        });

        return changed ? newMap : prev;
      });
    };

    const interval = setInterval(checkCompletedSessions, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <ScanSessionContext.Provider
      value={{
        activeSessions,
        addSession,
        removeSession,
        getSessionForLibrary,
        isLoading,
      }}
    >
      {children}
    </ScanSessionContext.Provider>
  );
};

export const useScanSessionContext = () => {
  const context = useContext(ScanSessionContext);
  if (!context) {
    throw new Error(
      'useScanSessionContext must be used within ScanSessionProvider',
    );
  }
  return context;
};
