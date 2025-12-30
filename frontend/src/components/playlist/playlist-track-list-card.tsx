import { PlaylistTrack } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { formatDuration } from '@/lib/utils';
import { useNavigate } from '@tanstack/react-router';
import { Brain, GripVertical, Pause, Play, Trash2 } from 'lucide-react';

export const PlaylistTrackListCard = ({
  playlistTrack,
  index,
  handleRemoveTrack,
  removingTrackId,
  setQueue,
}: {
  playlistTrack: PlaylistTrack;
  index: number;
  handleRemoveTrack: (trackId: string) => void;
  removingTrackId: string | null;
  setQueue: () => void;
}) => {
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();
  const navigate = useNavigate();
  // Only check if this specific track is the current track and playing
  const isCurrentTrack = currentTrack?.id === playlistTrack.track.id;
  const isThisTrackPlaying = isCurrentTrack && isPlaying;

  const formattedImage = playlistTrack.track.imagePath || 'Unknown Image';
  const handlePlay = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    if (currentTrack?.id !== playlistTrack.track.id) {
      setCurrentTrack(playlistTrack.track);
    }
    setQueue();
    actions.togglePlayPause(playlistTrack.track.id);
  };
  return (
    <div
      key={playlistTrack.id}
      className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group"
    >
      {/* Position */}
      <div className="flex items-center gap-2 text-muted-foreground text-sm w-8">
        <GripVertical className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span>{index + 1}</span>
      </div>
      <img
        src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
        alt="Album Art"
        className="w-10 h-10 object-cover rounded-md"
      />
      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate capitalize">
          {playlistTrack.track.title || playlistTrack.track.artist}
        </div>
        <div className="text-sm text-muted-foreground truncate capitalize">
          {playlistTrack.track.artist || 'Unknown Artist'}
        </div>
      </div>

      {/* Genre */}
      <div className="hidden md:block">
        <Badge variant="secondary" className="text-xs">
          {playlistTrack.track.genre || 'Unknown'}
        </Badge>
      </div>
      <div className="hidden md:block">
        <Badge variant="outline" className="text-xs">
          {playlistTrack.track.subgenre || 'Unknown'}
        </Badge>
      </div>
      <div className="hidden md:block text-xs text-muted-foreground">
        {playlistTrack.track.tempo || 'Unknown'} BPM
      </div>
      {/* Duration */}
      <div className="text-sm text-muted-foreground">
        {formatDuration(playlistTrack.track.duration || 0)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handlePlay}>
          {isThisTrackPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
        <Button
          variant="ghost-destructive"
          size="sm"
          onClick={() => handleRemoveTrack(playlistTrack.track.id)}
        >
          <Trash2 className="h-4 w-4 " />
        </Button>
        <Button
          size="sm"
          onClick={() =>
            navigate({ to: `/research/${playlistTrack.track.id}` })
          }
          variant="ghost"
        >
          <Brain className="h-4 w-4 " />
        </Button>
      </div>
    </div>
  );
};
