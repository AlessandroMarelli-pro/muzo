/**
 * Context for managing active scan sessions
 * Tracks sessionIds for libraries being scanned
 * Automatically fetches active sessions from the database on mount
 */

import { useActiveScanSessions, useCompletedScanSessions } from '@/services/rest-client';
import sseService, { EtaConfidence, ScanEvent } from '@/services/sse-service';
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
  etaSeconds?: number | null;
  tracksPerSecond?: number | null;
  confidence?: EtaConfidence;
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

// The DB row (ScanSession) is the source of truth for progress -- it is updated atomically
// by the backend regardless of whether Redis pub/sub is available (it isn't on the Hugging
// Face ai-service deployment). Both the 'state' SSE event and the /scan-progress/active poll
// below carry absolute values sourced from that row, so merging them in is always safe. The
// one thing worth protecting against is a stale/out-of-order delivery moving a number
// backwards, which is guarded with monotonic merges rather than by refusing to merge at all.
const mergeMonotonic = (existing: ScanSession, incoming: Partial<ScanSession>): ScanSession => {
  const next: ScanSession = { ...existing };
  if (incoming.totalTracks !== undefined) next.totalTracks = incoming.totalTracks;
  if (incoming.completedTracks !== undefined) {
    next.completedTracks = Math.max(existing.completedTracks, incoming.completedTracks);
  }
  if (incoming.failedTracks !== undefined) {
    next.failedTracks = Math.max(existing.failedTracks, incoming.failedTracks);
  }
  if (incoming.overallProgress !== undefined) {
    next.overallProgress = Math.max(existing.overallProgress, incoming.overallProgress);
  }
  if (incoming.status !== undefined) next.status = incoming.status;
  if (incoming.completedAt !== undefined) next.completedAt = incoming.completedAt;
  if (incoming.etaSeconds !== undefined) next.etaSeconds = incoming.etaSeconds;
  if (incoming.tracksPerSecond !== undefined) next.tracksPerSecond = incoming.tracksPerSecond;
  if (incoming.confidence !== undefined) next.confidence = incoming.confidence;
  return next;
};

export const ScanSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSessions, setActiveSessions] = useState<Map<string, ScanSession>>(new Map());
  const [completedSessions, setCompletedSessions] = useState<Map<string, ScanSession>>(new Map());
  const { data: activeSessionsFromDB, isLoading } = useActiveScanSessions();
  const { data: completedSessionsFromDB, isLoading: isCompletedSessionsLoading } =
    useCompletedScanSessions();
  // Load active sessions from database on mount and whenever the 10s poll refreshes.
  useEffect(() => {
    setActiveSessions((prev) => {
      const dbSessionIds = new Set((activeSessionsFromDB ?? []).map((s) => s.sessionId));
      let changed = false;
      const newMap = new Map(prev);

      (activeSessionsFromDB ?? []).forEach((session) => {
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
          etaSeconds: session.etaSeconds,
          tracksPerSecond: session.tracksPerSecond,
          confidence: session.confidence,
        };

        const existing = newMap.get(session.sessionId);
        if (!existing) {
          newMap.set(session.sessionId, scanSession);
          changed = true;
          // Automatically connect to SSE for this session
          if (!sseService.isConnected(session.sessionId)) {
            sseService.connect(session.sessionId);
          }
        } else {
          // The DB row is authoritative; merge it in monotonically rather than skipping it.
          // SSE keeps this session fresher between polls, but a session seeded before SSE
          // connects (or one whose 'state' event was missed) must not go stale forever.
          const merged = mergeMonotonic(existing, scanSession);
          if (merged !== existing) {
            newMap.set(session.sessionId, merged);
            changed = true;
          }
        }
      });

      // The active-sessions list is authoritative for "is this scan still running": if a
      // tracked session no longer appears in a successful poll response, the scan ended
      // (completed, was stopped, or errored) without us necessarily seeing a terminal SSE
      // event -- e.g. StopLibraryScan deletes the session and emits nothing. Drop it instead
      // of leaving the spinner running forever.
      if (activeSessionsFromDB) {
        for (const sessionId of Array.from(newMap.keys())) {
          if (!dbSessionIds.has(sessionId)) {
            newMap.delete(sessionId);
            sseService.disconnect(sessionId);
            changed = true;
          }
        }
      }

      return changed ? newMap : prev;
    });
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

          if (event.type === 'state') {
            // The authoritative event: absolute values straight from the ScanSession DB row,
            // pushed on a short poll interval by the backend. This is what makes progress
            // correct even when no Redis event ever arrives.
            newMap.set(
              sessionId,
              mergeMonotonic(existing, {
                status: event.data?.status,
                totalTracks: event.data?.totalTracks,
                completedTracks: event.data?.completedTracks,
                failedTracks: event.data?.failedTracks,
                overallProgress: event.overallProgress,
                etaSeconds: event.data?.etaSeconds,
                tracksPerSecond: event.data?.tracksPerSecond,
                confidence: event.data?.confidence,
              }),
            );
          } else if (event.type === 'scan.complete') {
            // Final, authoritative totals for the whole scan.
            newMap.set(sessionId, {
              ...existing,
              status: 'IDLE',
              overallProgress: event.overallProgress ?? existing.overallProgress,
              completedTracks: event.data?.successful ?? existing.completedTracks,
              failedTracks: event.data?.failed ?? existing.failedTracks,
              totalTracks: event.data?.totalTracks ?? existing.totalTracks,
              etaSeconds: null,
            });
          } else if (event.overallProgress !== undefined) {
            // batch.complete and similar: an absolute overallProgress, no track counts (those
            // come from the next 'state' event or DB poll -- never accumulate them here).
            newMap.set(
              sessionId,
              mergeMonotonic(existing, { overallProgress: event.overallProgress }),
            );
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
