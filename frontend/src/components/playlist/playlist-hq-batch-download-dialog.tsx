import { Playlist } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useCancelPlaylistHqAudioDownload, useDownloadPlaylistHqAudio } from '@/services/api-hooks';
import { useHqAudioBatchProgress } from '@/services/hq-audio-batch-sse-service';
import { Ban, CheckCircle2, Download, Loader2, SkipForward, Square, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isHqAudio } from '../track/audio-quality-badge';

interface PlaylistHqBatchDownloadDialogProps {
  playlist: Playlist | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const batchIdStorageKey = (playlistId: string) => `hq-batch:${playlistId}`;

function statusIcon(status: string) {
  switch (status) {
    case 'downloading':
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    case 'succeeded':
      return <CheckCircle2 className="h-4 w-4 text-primary" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'skipped':
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    case 'cancelled':
      return <Ban className="h-4 w-4 text-muted-foreground" />;
    default:
      return <div className="h-4 w-4 rounded-full border border-muted-foreground/40" />;
  }
}

export function PlaylistHqBatchDownloadDialog({
  playlist,
  open,
  onOpenChange,
}: PlaylistHqBatchDownloadDialogProps) {
  const [batchId, setBatchId] = useState<string | undefined>(undefined);
  const downloadPlaylistHqAudio = useDownloadPlaylistHqAudio();
  const cancelPlaylistHqAudioDownload = useCancelPlaylistHqAudioDownload();
  const { state } = useHqAudioBatchProgress(batchId);

  useEffect(() => {
    if (!playlist?.id) return;
    const storedBatchId = localStorage.getItem(batchIdStorageKey(playlist.id));
    if (storedBatchId) {
      setBatchId(storedBatchId);
    }
  }, [playlist?.id]);

  useEffect(() => {
    if (!playlist?.id || !batchId) return;
    if (state?.status === 'completed' || state?.status === 'cancelled') {
      localStorage.removeItem(batchIdStorageKey(playlist.id));
    }
  }, [playlist?.id, batchId, state?.status]);

  const tracksNeedingDownload = (playlist?.tracks ?? []).filter(
    (playlistTrack) => !isHqAudio(playlistTrack.track?.format, playlistTrack.track?.hqAudioPath),
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

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (state?.status === 'completed' || state?.status === 'cancelled')) {
      setBatchId(undefined);
    }
    onOpenChange(nextOpen);
  };

  const progressValue = state && state.total > 0
    ? ((state.succeeded + state.failed + state.skipped + state.cancelled) / state.total) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Download All in HQ</DialogTitle>
          <DialogDescription>
            {state?.status === 'cancelled'
              ? 'Download cancelled.'
              : state
                ? 'Downloading lossless copies via Soulseek.'
                : `${tracksNeedingDownload.length} of ${playlist?.tracks?.length ?? 0} tracks need an HQ download.`}
          </DialogDescription>
        </DialogHeader>

        {!state && (
          <div className="text-sm text-muted-foreground">
            Tracks already in HQ (FLAC/WAV) will be skipped automatically. Up to 5 tracks download
            at once.
          </div>
        )}

        {state && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Progress value={progressValue} />
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{state.succeeded} succeeded</Badge>
                <Badge variant="outline">{state.failed} failed</Badge>
                <Badge variant="outline">{state.skipped} skipped</Badge>
                <Badge variant="outline">{state.downloading} downloading</Badge>
                {state.cancelled > 0 && (
                  <Badge variant="outline">{state.cancelled} cancelled</Badge>
                )}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto overflow-x-hidden space-y-1">
              {state.tracks.map((track) => (
                <div key={track.trackId} className="flex items-center gap-2 text-sm py-1 min-w-0">
                  <span className="shrink-0">{statusIcon(track.status)}</span>
                  <span className="truncate min-w-0">
                    {track.artist} - {track.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {!state && (
            <Button
              onClick={handleStart}
              disabled={downloadPlaylistHqAudio.isPending || tracksNeedingDownload.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              {downloadPlaylistHqAudio.isPending ? 'Starting…' : 'Start Download'}
            </Button>
          )}
          {state?.status === 'running' && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelPlaylistHqAudioDownload.isPending}
            >
              <Square className="h-4 w-4 mr-2" />
              {cancelPlaylistHqAudioDownload.isPending ? 'Stopping…' : 'Stop'}
            </Button>
          )}
          {(state?.status === 'completed' || state?.status === 'cancelled') && (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
