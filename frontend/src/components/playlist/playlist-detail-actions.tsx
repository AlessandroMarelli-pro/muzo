import { Playlist } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import {
  ChevronDown,
  ListMusic,
  Pause,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';

interface PlaylistDetailActionsProps {
  playlist: Playlist | undefined;
  isLoading: boolean;
  isDeleting: boolean;
  isSettingAsQueue: boolean;
  onDelete: () => void;
  onSetAsQueue: () => void;
  onAddTrack: () => void;
}

export function PlaylistDetailActions({
  playlist,
  isLoading,
  isDeleting,
  isSettingAsQueue,
  onDelete,
  onSetAsQueue,
  onAddTrack,
}: PlaylistDetailActionsProps) {
  const { setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();

  const handlePlay = () => {
    if (!playlist?.tracks[0]?.track) return;
    setCurrentTrack(playlist?.tracks[0]?.track || undefined);
    actions.play(playlist?.tracks[0]?.track?.id || '');
  };
  const isDisabled = isLoading || !playlist;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" disabled={isDisabled}>
          <ChevronDown className="h-4 w-4 mr-2" />
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onAddTrack} disabled={isDisabled}>
          <Plus className="h-4 w-4 mr-2" />
          Add Track
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onSetAsQueue}
          disabled={isDisabled || isSettingAsQueue}
        >
          <ListMusic className="h-4 w-4 mr-2" />
          {isSettingAsQueue ? 'Setting as Queue...' : 'Set as Queue'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePlay} disabled={isDisabled}>
          {isPlaying ? (
            <>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Play
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          disabled={isDisabled || isDeleting}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Playlist
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
