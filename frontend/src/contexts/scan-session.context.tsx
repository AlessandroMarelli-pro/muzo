/**
 * Context for managing active scan sessions
 * Tracks sessionIds for libraries being scanned
 * Automatically fetches active sessions from the database on mount
 */

import { useActiveScanSessions, useCompletedScanSessions } from '@/services/rest-client';
import sseService, { ScanEvent } from '@/services/sse-service';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface ScanSession {
  sessionId: string;
  libraryId?: string;
  startedAt: string;
  status?: string;
  totalTracks: number;
  completedTracks: number;
  failedTracks: number;
  completedAt?: string;
  overallProgress: number;
}

interface ScanSessionContextType {
  /** Keyed only by sessionId. Use getSessionForLibrary to look up by library. */
  activeSessions: Map<string, ScanSession>;
  addSession: (sessionId: string, libraryId?: string) => void;
  removeSession: (sessionId: string) => void;
  getSessionForLibrary: (libraryId: string) => ScanSession | undefined;
  isLoading: boolean;
  completedSessions: Map<string, ScanSession>;
  isCompletedSessionsLoading: boolean;
}

const ScanSessionContext = createContext<ScanSessionContextType | undefined>(undefined);

export const ScanSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSessions, setActiveSessions] = useState<Map<string, ScanSession>>(new Map());
  const [completedSessions, setCompletedSessions] = useState<Map<string, ScanSession>>(new Map());
  const { data: activeSessionsFromDB, isLoading } = useActiveScanSessions();
  const { data: completedSessionsFromDB, isLoading: isCompletedSessionsLoading } =
    useCompletedScanSessions();
  // Load active sessions from database on mount and when they change
  useEffect(() => {
    if (activeSessionsFromDB && activeSessionsFromDB.length > 0) {
      setActiveSessions((prev) => {
        let changed = false;
        const newMap = new Map(prev);

        // Seed any session the client doesn't already know about (e.g. after a refresh, or a
        // scan started elsewhere). Never overwrite a session we're already tracking -- SSE
        // keeps those live and up to date, and this poll response can be up to 10s stale, so
        // blindly overwriting could regress progress backward.
        activeSessionsFromDB.forEach((session) => {
          if (newMap.has(session.sessionId)) return;

          const scanSession: ScanSession = {
            sessionId: session.sessionId,
            libraryId: session.libraryId,
            startedAt: session.startedAt,
            status: session.status,
            totalTracks: session.totalTracks,
            completedTracks: session.completedTracks,
            failedTracks: session.failedTracks,
            completedAt: session.completedAt,
            overallProgress: session.overallProgress,
          };
          newMap.set(session.sessionId, scanSession);
          changed = true;

          // Automatically connect to SSE for this session
          if (!sseService.isConnected(session.sessionId)) {
            sseService.connect(session.sessionId);
          }
        });

        return changed ? newMap : prev;
      });
    }
  }, [activeSessionsFromDB]);
  useEffect(() => {
    if (completedSessionsFromDB && completedSessionsFromDB.length > 0) {
      setCompletedSessions((prev) => {
        const newMap = new Map(prev);
        completedSessionsFromDB.forEach((session) => {
          newMap.set(session.sessionId, session);
        });
        return newMap;
      });
    }
  }, [completedSessionsFromDB]);

  const addSession = (sessionId: string, libraryId?: string) => {
    setActiveSessions((prev) => {
      const newMap = new Map(prev);
      const session: ScanSession = {
        sessionId,
        libraryId,
        startedAt: new Date().toISOString(),
        status: 'SCANNING',
        totalTracks: 0,
        completedTracks: 0,
        failedTracks: 0,
        completedAt: undefined,
        overallProgress: 0,
      };
      newMap.set(sessionId, session);

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
      newMap.delete(sessionId);

      // Disconnect from SSE
      sseService.disconnect(sessionId);

      return newMap;
    });
  };

  const getSessionForLibrary = (libraryId: string): ScanSession | undefined => {
    console.log('getSessionForLibrary', libraryId, activeSessions);
    for (const session of activeSessions.values()) {
      if (session.libraryId === libraryId) {
        return session;
      }
    }

    return undefined;
  };

  // Keep activeSessions live: subscribe to SSE for every tracked session and merge incoming
  // progress into the shared map, so progress survives navigation/remounts (not just whatever
  // component happens to call useScanProgress) and doesn't wait on the 10s DB poll.
  const unsubscribeFnsRef = useRef(new Map<string, () => void>());
  useEffect(() => {
    const subscribed = unsubscribeFnsRef.current;
    const sessionIds = new Set(activeSessions.keys());

    for (const sessionId of sessionIds) {
      if (subscribed.has(sessionId)) continue;
      const unsubscribe = sseService.subscribe(sessionId, (event: ScanEvent) => {
        if (event.type === 'error') return;
        setActiveSessions((prev) => {
          const existing = prev.get(sessionId);
          if (!existing) return prev;
          const newMap = new Map(prev);

          if (event.type === 'scan.complete') {
            // Final, authoritative totals for the whole scan.
            newMap.set(sessionId, {
              ...existing,
              status: 'IDLE',
              overallProgress: event.overallProgress ?? existing.overallProgress,
              completedTracks: event.data?.successful ?? existing.completedTracks,
              failedTracks: event.data?.failed ?? existing.failedTracks,
              totalTracks: event.data?.totalTracks ?? existing.totalTracks,
            });
          } else if (event.type === 'batch.complete') {
            // Per-batch counts: accumulate onto the running totals.
            newMap.set(sessionId, {
              ...existing,
              overallProgress: event.overallProgress ?? existing.overallProgress,
              completedTracks: existing.completedTracks + (event.data?.successful ?? 0),
              failedTracks: existing.failedTracks + (event.data?.failed ?? 0),
            });
          } else if (event.overallProgress !== undefined) {
            newMap.set(sessionId, { ...existing, overallProgress: event.overallProgress });
          } else {
            return prev;
          }

          return newMap;
        });
      });
      subscribed.set(sessionId, unsubscribe);
    }

    for (const [sessionId, unsubscribe] of subscribed) {
      if (!sessionIds.has(sessionId)) {
        unsubscribe();
        subscribed.delete(sessionId);
      }
    }
  }, [activeSessions]);

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
        completedSessions,
        isCompletedSessionsLoading,
      }}
    >
      {children}
    </ScanSessionContext.Provider>
  );
};

export const useScanSessionContext = () => {
  const context = useContext(ScanSessionContext);
  if (!context) {
    throw new Error('useScanSessionContext must be used within ScanSessionProvider');
  }
  return context;
};
