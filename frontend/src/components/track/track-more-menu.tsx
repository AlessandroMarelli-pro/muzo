import { apiUrl } from '@/lib/api-config';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { useDownloadHqAudio, useEnhanceHqAudio, useScanTrack } from '@/services/api-hooks';
import { useAddTrackToQueue } from '@/services/queue-hooks';
import { useNavigate } from '@tanstack/react-router';
import { Download, ListEnd, Music, RefreshCw, Sparkles, SquareArrowOutUpRight } from 'lucide-react';
import { useState } from 'react';
import { SelectPlaylistTrigger } from '../playlist/select-playlist-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { isHqAudio } from './audio-quality-badge';

type ConfirmKind = 'reanalyze' | 'enhance' | null;

export const TrackMoreMenu = ({
  trackId,
  artist,
  title,
  format,
  hqAudioPath,
  imagePath,
}: {
  trackId: string;
  artist: string;
  title: string;
  format?: string | null;
  hqAudioPath?: string | null;
  imagePath?: string | null;
}) => {
  const navigate = useNavigate();
  const { addSession } = useScanSessionContext();
  const addToQueueMutation = useAddTrackToQueue();
  const scanTrackMutation = useScanTrack();
  const downloadHqAudioMutation = useDownloadHqAudio();
  const enhanceHqAudioMutation = useEnhanceHqAudio();
  const alreadyHq = isHqAudio(format, hqAudioPath);
  const scanning = scanTrackMutation.isPending;

  const [confirm, setConfirm] = useState<ConfirmKind>(null);

  const handleAddToQueue = () => {
    addToQueueMutation.mutate(trackId);
  };

  const runScan = (force: boolean) => {
    scanTrackMutation.mutate(
      { trackId, force },
      {
        onSuccess: (sessionId) => {
          if (sessionId) {
            addSession(sessionId);
          }
        },
      },
    );
  };

  const handleEnhanceHqAudio = () => {
    enhanceHqAudioMutation.mutate(trackId);
  };

  const handleDownloadHqAudio = () => {
    downloadHqAudioMutation.mutate(trackId);
  };

  const handleViewDetails = () => {
    navigate({ to: '/research/{-$trackId}', params: { trackId } });
  };

  const coverSrc = imagePath
    ? apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(imagePath)}`)
    : null;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild disabled={!trackId}>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Track actions for {title || 'this track'}</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[var(--z-player-overlay)] w-60">
          <DropdownMenuLabel className="flex items-center gap-2.5 p-0 font-normal">
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
              {coverSrc ? (
                <img
                  src={coverSrc}
                  alt=""
                  className="size-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Music className="size-4 text-muted-foreground/60" aria-hidden />
              )}
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5 py-1 text-left">
              <span className="truncate text-sm font-semibold leading-tight">
                {title || 'Untitled track'}
              </span>
              <span className="truncate text-xs leading-tight text-muted-foreground">
                {artist || 'Unknown artist'}
              </span>
            </span>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={handleAddToQueue}>
              <ListEnd />
              Add to queue
            </DropdownMenuItem>
            <SelectPlaylistTrigger trackId={trackId} artist={artist} title={title} />
            <DropdownMenuItem onClick={handleViewDetails}>
              <SquareArrowOutUpRight />
              View details
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={handleDownloadHqAudio}
              disabled={alreadyHq || downloadHqAudioMutation.isPending}
            >
              <Download className={downloadHqAudioMutation.isPending ? 'animate-spin' : undefined} />
              {alreadyHq ? 'HQ audio available' : 'Download HQ audio'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                if (!alreadyHq) setConfirm('enhance');
              }}
              disabled={alreadyHq || enhanceHqAudioMutation.isPending}
            >
              <Sparkles
                className={enhanceHqAudioMutation.isPending ? 'animate-spin' : undefined}
              />
              {alreadyHq ? 'HQ audio available' : 'Enhance with AI'}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => runScan(false)} disabled={scanning}>
              <RefreshCw className={scanning ? 'animate-spin' : undefined} />
              Rescan track
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={scanning}>
                <RefreshCw className={scanning ? 'animate-spin' : undefined} />
                Advanced
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirm('reanalyze');
                  }}
                  disabled={scanning}
                  className="text-destructive focus:text-destructive"
                >
                  <RefreshCw />
                  Re-analyze from scratch
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'reanalyze' ? 'Re-analyze this track from scratch?' : 'Enhance with AI?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'reanalyze' ? (
                <>
                  This discards the current metadata and analysis for{' '}
                  <span className="font-medium text-foreground">{title || 'this track'}</span> and
                  rebuilds everything. Any manual corrections will be lost. Takes about a minute.
                </>
              ) : (
                <>
                  This generates an enhanced, higher-quality version of{' '}
                  <span className="font-medium text-foreground">{title || 'this track'}</span> in the
                  background. It can take a few minutes.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === 'reanalyze') runScan(true);
                if (confirm === 'enhance') handleEnhanceHqAudio();
                setConfirm(null);
              }}
              className={
                confirm === 'reanalyze'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
            >
              {confirm === 'reanalyze' ? 'Re-analyze' : 'Enhance'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
