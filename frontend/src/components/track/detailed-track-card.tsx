import { SimpleMusicTrack } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
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
import { Skeleton } from '../ui/skeleton';

interface DetailedTrackCardProps {
  track?: SimpleMusicTrack;
  refetch: () => void;
  isLoading: boolean;
}

function DetailedTrackCardSkeleton() {
  return (
    <Card className="w-full  border-none ">
      <CardHeader className="flex flex-row justify-between items-center">
        {/* Genre Tags */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="w-20 h-5 rounded-full" />
          ))}
        </div>
        {/* Metadata Grid */}
        <div className="flex flex-row gap-2">
          <Skeleton className="w-10 h-5 rounded-full" />
          <Skeleton className="w-10 h-5 rounded-full" />
          <Skeleton className="w-10 h-5 rounded-full" />
          <Skeleton className="w-10 h-5 rounded-full" />
          <Skeleton className="w-10 h-5 rounded-full" />
          <Skeleton className="w-10 h-5 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="px-4">
        {/* Header Section */}
        <div className="flex items-start gap-6">
          {/* Album Art */}
          <div className="relative flex-shrink-0">
            <div className="w-40 h-40 rounded-full overflow-hidden bg-muted flex items-center justify-center shadow-md hover:scale-105 transition-all duration-300">
              <Skeleton className="w-full h-full rounded-full" />
            </div>
            <Button
              size="sm"
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full p-0 bg-secondary hover:bg-muted-foreground text-secondary-foreground"
            >
              <Skeleton className="w-8 h-8 rounded-full" />
            </Button>
          </div>

          {/* Track Info */}
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div>
              <h1 className="text-lg  text-foreground truncate capitalize max-w-md ">
                <Skeleton className="w-full h-6" />
              </h1>
            </div>

            <div className="text-sm text-muted-foreground  ">
              <Skeleton className="w-full h-6" />
            </div>
            <div className="text-sm text-muted-foreground  ">
              <Skeleton className="w-full h-6" />
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex flex-col items-end justify-center gap-2">
            <div className="flex gap-2">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-row justify-between items-center">
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 4 }).map((_, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="capitalize"
              size="xs"
            >
              <Skeleton className="w-20 h-5 rounded-full" />
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="w-20 h-5 rounded-full" />

          ))}
        </div>
      </CardFooter>

    </Card>
  );
}

export function DetailedTrackCard({ track, refetch, isLoading }: DetailedTrackCardProps) {
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();
  const isCurrentTrack = currentTrack?.id === track?.id;
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
    if (currentTrack?.id !== track?.id && track) {
      setCurrentTrack(track);
      actions.play(track?.id || '');
    } else {
      // Same track - toggle play/pause
      if (isPlaying) {
        actions.pause(track?.id || '');
      } else {
        actions.play(track?.id || '');
      }
    }
  };

  if (isLoading || !track) {
    return <DetailedTrackCardSkeleton />;
  }
  return (
    <Card className="w-full  border-none ">
      <CardHeader className="flex flex-row justify-between items-center">
        {/* Genre Tags */}
        {track.genres && track.genres.length > 0 && (
          <div className="flex ">
            {track.genres.map((genre, index) => (
              <Badge
                key={index}
                variant="outline"
                className="capitalize border-none"
                size="xs"
              >
                {genre}
              </Badge>
            ))}
          </div>
        )}
        {/* Metadata Grid */}
        <div className="flex flex-row gap-2">
          <Badge
            variant="outline"
            className="flex items-center gap-2  "
            size="xs"
          >
            <Clock size={64} />
            <span>{formatDuration(track.duration)}</span>
          </Badge>
          <Badge
            variant="outline"
            className="flex items-center gap-2  "
            size="xs"
          >
            <Activity className="w-4 h-4" />
            <span>{track.listeningCount} plays</span>
          </Badge>
          <Badge
            variant="outline"
            className="flex items-center gap-2  "
            size="xs"
          >
            <Music className="w-4 h-4" />
            <span>{formatBPM(track.tempo || 0)} BPM</span>
          </Badge>
          <Badge
            variant="outline"
            className="flex items-center gap-2  "
            size="xs"
          >
            <Zap className="w-4 h-4" />
            <span className="capitalize">{track.arousalMood}</span>
          </Badge>
          <Badge
            variant="outline"
            className="flex items-center gap-2  "
            size="xs"
          >
            <Activity className="w-4 h-4" />
            <span className="capitalize">{track.danceabilityFeeling}</span>
          </Badge>{' '}
          <Badge
            variant="outline"
            className="flex items-center gap-2  "
            size="xs"
          >
            <Activity className="w-4 h-4" />
            <span className="capitalize">{track.valenceMood}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        {/* Header Section */}
        <div className="flex items-start gap-6">
          {/* Album Art */}
          <div className="relative flex-shrink-0">
            <div className="w-40 h-40 rounded-full overflow-hidden bg-muted flex items-center justify-center shadow-md hover:scale-105 transition-all duration-300">
              <img
                src={`http://localhost:3000/api/images/serve?imagePath=${track.imagePath}`}
                alt="Album Art"
                className="w-full h-full object-cover  "
              />
            </div>
            <Button
              size="sm"
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full p-0 bg-secondary hover:bg-muted-foreground text-secondary-foreground"
              onClick={handlePlay}
            >
              {isThisTrackPlaying ? (
                <Pause className="w-4 h-4 " />
              ) : (
                <Play className="w-4 h-4 " />
              )}
            </Button>
          </div>

          {/* Track Info */}
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div>
              <h1 className="text-lg  text-foreground truncate capitalize max-w-md ">
                {track.artist} - {track.title}
              </h1>
            </div>

            {track?.contextBackgrounds && (
              <div className="text-sm text-muted-foreground  ">
                {track?.contextBackgrounds}
              </div>
            )}
            {track?.contextImpacts && (
              <div className="text-sm text-muted-foreground  ">
                {track?.contextImpacts}
              </div>
            )}
          </div>
          {/* Action Buttons */}
          <div className="flex flex-col items-end justify-center gap-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refetch}>
                <Shuffle className="w-4 h-4" />
                Random Track
              </Button>
              <Button variant="outline" size="sm">
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
      <CardFooter className="flex flex-row justify-between items-center">
        {track.subgenres && track.subgenres.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {track.subgenres.map((subgenre, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="capitalize"
                size="xs"
              >
                {subgenre}
              </Badge>
            ))}
          </div>
        )}
        {track?.atmosphereKeywords && (
          <div className="flex flex-wrap gap-2">
            {track?.atmosphereKeywords.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                size="xs"
                className="border-none"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
