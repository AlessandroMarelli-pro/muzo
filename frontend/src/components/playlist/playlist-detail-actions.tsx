import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ListMusic, Pause, Play, Plus, Trash2 } from 'lucide-react';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import {
  useAddTrackToQueue,
  useQueue,
  useRemoveTrackFromQueue,
} from '@/services/queue-hooks';

interface PlaylistDetailActionsProps {
  playlist: {
    id: string;
    tracks: Array<{ track?: { id: string } | null }>;
  } | null;
  isDeleting: boolean;
  isSettingAsQueue: boolean;
  onDelete: () => void;
  onSetAsQueue: () => void;
  onAddTrack: () => void;
}

export function PlaylistDetailActions({
  playlist,
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
    setCurrentTrack(playlist.tracks[0].track);
    actions.play(playlist.tracks[0].track.id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" disabled={!playlist}>
          <ChevronDown className="h-4 w-4 mr-2" />
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={onAddTrack}
          disabled={!playlist}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Track
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onSetAsQueue}
          disabled={isSettingAsQueue || !playlist}
        >
          <ListMusic className="h-4 w-4 mr-2" />
          {isSettingAsQueue ? 'Setting as Queue...' : 'Set as Queue'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePlay} disabled={!playlist}>
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
          disabled={isDeleting || !playlist}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Playlist
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
