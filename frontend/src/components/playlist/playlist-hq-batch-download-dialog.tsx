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
import { useDownloadPlaylistHqAudio } from '@/services/api-hooks';
import { useHqAudioBatchProgress } from '@/services/hq-audio-batch-sse-service';
import { CheckCircle2, Download, Loader2, SkipForward, XCircle } from 'lucide-react';
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
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'skipped':
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
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
    if (state?.status === 'completed') {
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

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && state?.status === 'completed') {
      setBatchId(undefined);
    }
    onOpenChange(nextOpen);
  };

  const progressValue = state && state.total > 0
    ? ((state.succeeded + state.failed + state.skipped) / state.total) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download All in HQ</DialogTitle>
          <DialogDescription>
            {state
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
              <div className="flex gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{state.succeeded} succeeded</Badge>
                <Badge variant="outline">{state.failed} failed</Badge>
                <Badge variant="outline">{state.skipped} skipped</Badge>
                <Badge variant="outline">{state.downloading} downloading</Badge>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {state.tracks.map((track) => (
                <div key={track.trackId} className="flex items-center gap-2 text-sm py-1">
                  {statusIcon(track.status)}
                  <span className="truncate">
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
          {state?.status === 'completed' && (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
