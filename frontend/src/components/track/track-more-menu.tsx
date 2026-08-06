import { useScanSessionContext } from '@/contexts/scan-session.context';
import { useDownloadHqAudio, useScanTrack } from '@/services/api-hooks';
import { useAddTrackToQueue } from '@/services/queue-hooks';
import { Download, MoreHorizontal, RefreshCw } from 'lucide-react';
import { SelectPlaylistTrigger } from '../playlist/select-playlist-dialog';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export const TrackMoreMenu = ({
  trackId,
  artist,
  title,
  hqAudioPath,
}: {
  trackId: string;
  artist: string;
  title: string;
  hqAudioPath?: string | null;
}) => {
  const { addSession } = useScanSessionContext();
  const addToQueueMutation = useAddTrackToQueue();
  const scanTrackMutation = useScanTrack();
  const downloadHqAudioMutation = useDownloadHqAudio();

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

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={!trackId}>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-99999">
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
          disabled={!!hqAudioPath || downloadHqAudioMutation.isPending}
        >
          <Download
            className={
              downloadHqAudioMutation.isPending ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'
            }
          />
          {hqAudioPath ? 'HQ audio available' : 'Download HQ'}
        </DropdownMenuItem>
        <DropdownMenuItem>View Details</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
