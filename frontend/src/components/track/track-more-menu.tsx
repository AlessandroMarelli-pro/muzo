import { useScanSessionContext } from '@/contexts/scan-session.context';
import { useDownloadHqAudio, useEnhanceHqAudio, useScanTrack } from '@/services/api-hooks';
import { useAddTrackToQueue } from '@/services/queue-hooks';
import { Download, MoreHorizontal, RefreshCw, Sparkles } from 'lucide-react';
import { SelectPlaylistTrigger } from '../playlist/select-playlist-dialog';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { isHqAudio } from './audio-quality-badge';

export const TrackMoreMenu = ({
  trackId,
  artist,
  title,
  format,
  hqAudioPath,
}: {
  trackId: string;
  artist: string;
  title: string;
  format?: string | null;
  hqAudioPath?: string | null;
}) => {
  const { addSession } = useScanSessionContext();
  const addToQueueMutation = useAddTrackToQueue();
  const scanTrackMutation = useScanTrack();
  const downloadHqAudioMutation = useDownloadHqAudio();
  const enhanceHqAudioMutation = useEnhanceHqAudio();
  const alreadyHq = isHqAudio(format, hqAudioPath);

  const handleAddToQueue = () => {
    addToQueueMutation.mutate(trackId);
  };

  const handleScanTrack = (force: boolean) => () => {
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

  const handleDownloadHqAudio = () => {
    downloadHqAudioMutation.mutate(trackId);
  };

  const handleEnhanceHqAudio = () => {
    enhanceHqAudioMutation.mutate(trackId);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={!trackId}>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[var(--z-player-overlay)]">
        <DropdownMenuItem onClick={handleAddToQueue}>Add to Queue</DropdownMenuItem>
        <SelectPlaylistTrigger trackId={trackId} artist={artist} title={title} />
        <DropdownMenuItem
          onClick={handleScanTrack(false)}
          disabled={scanTrackMutation.isPending}
        >
          <RefreshCw
            className={scanTrackMutation.isPending ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'}
          />
          Rescan track
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleScanTrack(true)}
          disabled={scanTrackMutation.isPending}
        >
          <RefreshCw
            className={scanTrackMutation.isPending ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'}
          />
          Rescan track (force)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDownloadHqAudio}
          disabled={alreadyHq || downloadHqAudioMutation.isPending}
        >
          <Download
            className={
              downloadHqAudioMutation.isPending ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'
            }
          />
          {alreadyHq ? 'HQ audio available' : 'Download HQ'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleEnhanceHqAudio}
          disabled={alreadyHq || enhanceHqAudioMutation.isPending}
        >
          <Sparkles
            className={
              enhanceHqAudioMutation.isPending ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'
            }
          />
          {alreadyHq ? 'HQ audio available' : 'Enhance with AI'}
        </DropdownMenuItem>
        <DropdownMenuItem>View Details</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
