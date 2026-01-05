import { SimpleMusicTrack } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import {
  Activity,
  Clock,
  Heart,
  ListPlus,
  Music,
  Pause,
  Play,
  Shuffle,
  Zap,
} from 'lucide-react';

interface DetailedTrackCardProps {
  track: SimpleMusicTrack;
  refetch: () => void;
}

export function DetailedTrackCard({ track, refetch }: DetailedTrackCardProps) {
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();
  const isCurrentTrack = currentTrack?.id === track.id;
  const isThisTrackPlaying = isCurrentTrack && isPlaying;

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatBPM = (tempo?: number) => {
    return tempo ? `${Math.round(tempo)}` : 'N/A';
  };

  const handlePlay = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (currentTrack?.id !== track.id) {
      setCurrentTrack(track);
    }

    actions.togglePlayPause(track.id);
  };

  return (
    <Card className="w-full bg-primary-foreground border-none shadow-none">
      <CardContent className="p-6">
        {/* Header Section */}
        <div className="flex items-start gap-6">
          {/* Album Art */}
          <div className="relative flex-shrink-0">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-muted flex items-center justify-center shadow-sm hover:scale-105 transition-all duration-300">
              <img
                src={`http://localhost:3000/api/images/serve?imagePath=${track.imagePath}`}
                alt="Album Art"
                className="w-full h-full object-cover  "
              />
            </div>
            <Button
              size="sm"
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full p-0 bg-background hover:bg-background"
              onClick={handlePlay}
            >
              {isThisTrackPlaying ? (
                <Pause className="w-4 h-4 text-primary" />
              ) : (
                <Play className="w-4 h-4 text-primary" />
              )}
            </Button>
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <h1 className="text-xl font-bold text-foreground truncate capitalize">
                {track.artist} - {track.title}
              </h1>
            </div>
            {track?.description && (
              <div className="text-sm text-muted-foreground truncate capitalize">
                {track?.description}
              </div>
            )}
            {track?.tags && (
              <div className="flex flex-wrap gap-1 mt-2">
                {track?.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Metadata Grid */}
            <div className="flex flex-row gap-2">
              <Badge variant="secondary" className="flex items-center gap-2  ">
                <Clock size={64} />
                <span>{formatDuration(track.duration)}</span>
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-2  ">
                <Activity className="w-4 h-4" />
                <span>{track.listeningCount} plays</span>
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-2  ">
                <Music className="w-4 h-4" />
                <span>{formatBPM(track.tempo || 0)} BPM</span>
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-2  ">
                <Zap className="w-4 h-4" />
                <span>Energy: {track.arousalMood}</span>
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-2  ">
                <Activity className="w-4 h-4" />
                <span>Dance: {track.danceabilityFeeling}</span>
              </Badge>{' '}
              <Badge variant="secondary" className="flex items-center gap-2  ">
                <Activity className="w-4 h-4" />
                <span>Mood: {track.valenceMood}</span>
              </Badge>
            </div>

            {/* Genre Tags */}
            <div className="flex gap-2 mt-4">
              {track.genre && (
                <Badge variant="secondary" className="capitalize">
                  {track.genre}
                </Badge>
              )}
              {track.subgenre && (
                <Badge variant="secondary" className="capitalize">
                  {track.subgenre}
                </Badge>
              )}
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={refetch}>
                <Shuffle className="w-4 h-4" />
                Random Track
              </Button>
              <Button variant="secondary" size="sm">
                <ListPlus className="w-4 h-4" />
                Add to playlist
              </Button>
              <Button variant="destructive" size="sm">
                <Heart className="w-4 h-4" />
                Add to favorite
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
