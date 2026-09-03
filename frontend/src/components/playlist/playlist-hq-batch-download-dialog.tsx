import { Playlist } from "@/__generated__/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCancelPlaylistHqAudioDownload,
  useDownloadHqAudio,
  useDownloadPlaylistHqAudio,
} from "@/services/api-hooks";
import {
  HqAudioBatchState,
  HqAudioBatchTrackState,
  useHqAudioBatchProgress,
} from "@/services/hq-audio-batch-sse-service";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CheckCircle2,
  CircleDashed,
  Download,
  Loader2,
  MinusCircle,
  RotateCw,
  Square,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isHqAudio } from "../track/audio-quality-badge";

interface PlaylistHqBatchDownloadDialogProps {
  playlist: Playlist | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const batchIdStorageKey = (playlistId: string) => `hq-batch:${playlistId}`;

type TrackStatus = HqAudioBatchTrackState["status"];

const STATUS_META: Record<
  TrackStatus,
  { label: string; Icon: typeof CheckCircle2; className: string }
> = {
  queued: {
    label: "Queued",
    Icon: CircleDashed,
    className: "text-muted-foreground",
  },
  downloading: { label: "Downloading", Icon: Loader2, className: "text-info" },
  succeeded: {
    label: "Downloaded",
    Icon: CheckCircle2,
    className: "text-success",
  },
  failed: { label: "Failed", Icon: XCircle, className: "text-destructive" },
  skipped: {
    label: "Already HQ — skipped",
    Icon: BadgeCheck,
    className: "text-muted-foreground",
  },
  cancelled: {
    label: "Cancelled",
    Icon: MinusCircle,
    className: "text-muted-foreground",
  },
};

function TrackStatusIcon({ status }: { status: TrackStatus }) {
  const { Icon, className, label } = STATUS_META[status];
  return (
    <Icon
      role="img"
      aria-label={label}
      className={`h-4 w-4 shrink-0 ${className} ${status === "downloading" ? "animate-spin" : ""}`}
    />
  );
}

/** A lossless format landed on the track — read from the refetched playlist. */
function landedFormat(
  playlist: Playlist | undefined,
  trackId: string,
): string | undefined {
  const track = (playlist?.tracks ?? []).find(
    (pt) => pt.track?.id === trackId,
  )?.track;
  if (!track) return undefined;
  if (track.hqAudioPath) {
    const ext = track.hqAudioPath.split(".").pop()?.toUpperCase();
    return ext && /^[A-Z0-9]{2,4}$/.test(ext) ? ext : "HQ";
  }
  if (isHqAudio(track.format, track.hqAudioPath)) {
    return (track.format ?? "").toUpperCase() || "HQ";
  }
  return undefined;
}

function CountPill({
  count,
  label,
  variant,
}: {
  count: number;
  label: string;
  variant: "success" | "destructive" | "warning" | "info" | "secondary";
}) {
  if (count === 0) return null;
  return (
    <Badge variant={variant} className="gap-1 font-mono tabular-nums">
      {count} {label}
    </Badge>
  );
}

/** Progress bar segmented by outcome — succeeded / failed / skipped fill left to right. */
function SegmentedProgress({ state }: { state: HqAudioBatchState }) {
  const total = Math.max(state.total, 1);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className="relative flex h-2 w-full overflow-hidden rounded-full bg-secondary"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={state.total}
      aria-valuenow={
        state.succeeded + state.failed + state.skipped + state.cancelled
      }
    >
      <div
        className="h-full bg-success transition-[width] duration-300"
        style={{ width: pct(state.succeeded) }}
      />
      <div
        className="h-full bg-destructive transition-[width] duration-300"
        style={{ width: pct(state.failed) }}
      />
      <div
        className="h-full bg-muted-foreground/50 transition-[width] duration-300"
        style={{ width: pct(state.skipped + state.cancelled) }}
      />
    </div>
  );
}

export function PlaylistHqBatchDownloadDialog({
  playlist,
  open,
  onOpenChange,
}: PlaylistHqBatchDownloadDialogProps) {
  const [batchId, setBatchId] = useState<string | undefined>(undefined);
  const downloadPlaylistHqAudio = useDownloadPlaylistHqAudio();
  const cancelPlaylistHqAudioDownload = useCancelPlaylistHqAudioDownload();
  const retryTrackDownload = useDownloadHqAudio();
  const [retryingTrackIds, setRetryingTrackIds] = useState<Set<string>>(
    new Set(),
  );
  const { state, notFound } = useHqAudioBatchProgress(batchId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playlist?.id) return;
    const storedBatchId = localStorage.getItem(batchIdStorageKey(playlist.id));
    if (storedBatchId) {
      setBatchId(storedBatchId);
    }
  }, [playlist?.id]);

  useEffect(() => {
    if (!playlist?.id || !batchId) return;
    if (state?.status === "completed" || state?.status === "cancelled") {
      localStorage.removeItem(batchIdStorageKey(playlist.id));
    }
  }, [playlist?.id, batchId, state?.status]);

  // A stored batchId whose state has expired (or never existed) — drop it so the
  // SSE stops reconnecting.
  useEffect(() => {
    if (!playlist?.id || !batchId || !notFound) return;
    localStorage.removeItem(batchIdStorageKey(playlist.id));
    setBatchId(undefined);
  }, [playlist?.id, batchId, notFound]);

  // The batch writes `hqAudioPath` server-side as tracks succeed; refetch the
  // playlist so the HQ badges update live (throttled — a large batch fires many
  // track.update events).
  const succeededCount = state?.succeeded ?? 0;
  const lastRefetchAt = useRef(0);
  useEffect(() => {
    if (!playlist?.id || !batchId) return;
    const done = state?.status === "completed";
    const now = Date.now();
    if (done || now - lastRefetchAt.current > 2000) {
      lastRefetchAt.current = now;
      queryClient.invalidateQueries({ queryKey: ["playlist", playlist.id] });
    }
  }, [playlist?.id, batchId, succeededCount, state?.status, queryClient]);

  const tracksNeedingDownload = (playlist?.tracks ?? []).filter(
    (playlistTrack) =>
      !isHqAudio(playlistTrack.track?.format, playlistTrack.track?.hqAudioPath),
  );

  const handleStart = async () => {
    if (!playlist?.id) return;
    const result = await downloadPlaylistHqAudio.mutateAsync(playlist.id);
    localStorage.setItem(batchIdStorageKey(playlist.id), result.batchId);
    setBatchId(result.batchId);
  };

  const handleCancel = async () => {
    if (!batchId) return;
    await cancelPlaylistHqAudioDownload.mutateAsync(batchId);
  };

  const handleRetry = async (trackId: string) => {
    setRetryingTrackIds((prev) => new Set(prev).add(trackId));
    try {
      await retryTrackDownload.mutateAsync(trackId);
    } finally {
      setRetryingTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
      if (playlist?.id) {
        queryClient.invalidateQueries({ queryKey: ["playlist", playlist.id] });
      }
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (
      !nextOpen &&
      (state?.status === "completed" || state?.status === "cancelled")
    ) {
      setBatchId(undefined);
    }
    onOpenChange(nextOpen);
  };

  const isDone = state?.status === "completed" || state?.status === "cancelled";

  const description = useMemo(() => {
    if (!state) {
      return `${tracksNeedingDownload.length} of ${playlist?.tracks?.length ?? 0} tracks need an HQ download.`;
    }
    if (isDone) {
      const parts = [`${state.succeeded} downloaded`];
      if (state.failed > 0) parts.push(`${state.failed} failed`);
      if (state.skipped > 0) parts.push(`${state.skipped} skipped`);
      if (state.cancelled > 0) parts.push(`${state.cancelled} cancelled`);
      return state.status === "cancelled"
        ? `Stopped — ${parts.join(", ")}.`
        : `${parts.join(", ")}.`;
    }
    return "Downloading lossless copies from Soulseek.";
  }, [state, isDone, tracksNeedingDownload.length, playlist?.tracks?.length]);

  const completedUnits = state
    ? state.succeeded + state.failed + state.skipped + state.cancelled
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Download all in HQ</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!state && (
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p>
              Tracks already in HQ (FLAC/WAV) are skipped automatically. Up to 5
              download at once.
            </p>
            <p>
              Each lossless copy is saved alongside the original in your
              library.
            </p>
          </div>
        )}

        {state && (
          <div
            className="flex min-h-0 flex-1 flex-col gap-4"
            role="status"
            aria-live="polite"
          >
            <div className="space-y-2">
              <SegmentedProgress state={state} />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {completedUnits} / {state.total}
                </span>
                <CountPill
                  count={state.succeeded}
                  label="downloaded"
                  variant="success"
                />
                <CountPill
                  count={state.failed}
                  label="failed"
                  variant="destructive"
                />
                <CountPill
                  count={state.skipped}
                  label="skipped"
                  variant="secondary"
                />
                {!isDone && state.downloading > 0 && (
                  <CountPill
                    count={state.downloading}
                    label="downloading"
                    variant="info"
                  />
                )}
                <CountPill
                  count={state.cancelled}
                  label="cancelled"
                  variant="secondary"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden">
              <ul className="space-y-0.5">
                {state.tracks.map((track) => {
                  const format = landedFormat(playlist, track.trackId);
                  const isRetrying = retryingTrackIds.has(track.trackId);
                  return (
                    <li
                      key={track.trackId}
                      className="flex items-center gap-2 rounded-md py-1.5 text-sm"
                    >
                      <TrackStatusIcon status={track.status} />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-muted-foreground">
                          {track.artist}
                        </span>
                        {" — "}
                        {track.title}
                      </span>

                      {track.status === "succeeded" && format && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 font-mono uppercase"
                          aria-label={`Landed as ${format}`}
                        >
                          {format}
                        </Badge>
                      )}

                      {track.status === "failed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 shrink-0 px-2 text-xs"
                          onClick={() => handleRetry(track.trackId)}
                          disabled={isRetrying}
                        >
                          <RotateCw
                            className={`mr-1 h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`}
                            aria-hidden
                          />
                          {isRetrying ? "Retrying…" : "Retry"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>

              {state.tracks.some(
                (t) => t.status === "failed" && t.errorMessage,
              ) && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">
                    Why did some fail?
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {state.tracks
                      .filter((t) => t.status === "failed" && t.errorMessage)
                      .map((t) => (
                        <li key={t.trackId} className="truncate">
                          <span className="text-foreground">{t.title}</span> —{" "}
                          {t.errorMessage}
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {!state && (
            <Button
              onClick={handleStart}
              disabled={
                downloadPlaylistHqAudio.isPending ||
                tracksNeedingDownload.length === 0
              }
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              {downloadPlaylistHqAudio.isPending
                ? "Starting…"
                : "Start download"}
            </Button>
          )}
          {state?.status === "running" && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelPlaylistHqAudioDownload.isPending}
            >
              <Square className="mr-2 h-4 w-4" aria-hidden />
              {cancelPlaylistHqAudioDownload.isPending ? "Stopping…" : "Stop"}
            </Button>
          )}
          {isDone && (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
