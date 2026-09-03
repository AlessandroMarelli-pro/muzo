import { Playlist } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { Copy, Download, ListMusic, MoreHorizontal, Pause, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface PlaylistDetailActionsProps {
  playlist: Playlist | undefined;
  isLoading: boolean;
  isDeleting: boolean;
  isSettingAsQueue: boolean;
  onDelete: () => void;
  onSetAsQueue: () => void;
  onDownloadAllHq: () => void;
}

export function PlaylistDetailActions({
  playlist,
  isLoading,
  isDeleting,
  isSettingAsQueue,
  onDelete,
  onSetAsQueue,
  onDownloadAllHq,
}: PlaylistDetailActionsProps) {
  const { setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();

  const handlePlay = () => {
    if (!playlist?.tracks?.[0]?.track) return;
    setCurrentTrack(playlist?.tracks[0]?.track || undefined);
    actions.play(playlist?.tracks[0]?.track?.id || '');
  };

  const handleCopyList = async () => {
    if (!playlist?.tracks?.length) return;
    const escapeCsvField = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ['Artist', 'Title'],
      ...playlist.tracks.map((playlistTrack) => [
        playlistTrack.track?.artist || '',
        playlistTrack.track?.title || '',
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
    try {
      await navigator.clipboard.writeText(csv);
      toast.success('Tracklist copied to clipboard as CSV');
    } catch (error) {
      console.error('Failed to copy playlist:', error);
      toast.error('Could not copy the tracklist. Please try again.');
    }
  };

  const isDisabled = isLoading || !playlist;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          disabled={isDisabled}
          aria-label="More playlist actions"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePlay} disabled={isDisabled}>
          {isPlaying ? (
            <>
              <Pause className="h-4 w-4 mr-2" aria-hidden />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" aria-hidden />
              Play from the top
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSetAsQueue} disabled={isDisabled || isSettingAsQueue}>
          <ListMusic className="h-4 w-4 mr-2" aria-hidden />
          {isSettingAsQueue ? 'Replacing queue…' : 'Replace queue with this'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyList} disabled={isDisabled}>
          <Copy className="h-4 w-4 mr-2" aria-hidden />
          Copy tracklist (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownloadAllHq} disabled={isDisabled}>
          <Download className="h-4 w-4 mr-2" aria-hidden />
          Download all in HQ…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          disabled={isDisabled || isDeleting}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" aria-hidden />
          Delete playlist…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
