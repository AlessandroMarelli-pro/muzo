import { Track } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import {
  Activity,
  Angry,
  Clock,
  Dices,
  Frown,
  Heart,
  Laugh,
  Meh,
  Music,
  Pause,
  Play,
  Smile,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { SelectPlaylistTrigger } from '../playlist/select-playlist-dialog';
import { Skeleton } from '../ui/skeleton';
import { AudioQualityBadge } from './audio-quality-badge';
import { apiUrl } from '@/lib/api-config';

interface DetailedTrackCardProps {
  track?: Track;
  refetch: () => void;
  isLoading: boolean;
}

const getValenceIcon = (valence?: string | null) => {
  switch (valence?.toLowerCase()) {
    case 'very positive':
      return Laugh;
    case 'very negative':
      return Angry;
    case 'positive':
      return Smile;
    case 'negative':
      return Frown;
    default:
      return Meh;
  }
};

function DetailedTrackCardSkeleton() {
  return (
    <Card className="w-full  border-none ">
      <CardHeader className="flex flex-row justify-between items-center">
        {/* Genre Tags */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_) => (
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
            <div className="w-40 h-40 rounded-full overflow-hidden bg-muted flex items-center justify-center shadow-md hover:scale-105  duration-300">
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
          {Array.from({ length: 4 }).map((_) => (
            <Skeleton className="w-20 h-5 rounded-full" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_) => (
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
  const [isFavorite, setIsFavorite] = useState(track?.isFavorite);

  useEffect(() => {
    setIsFavorite(track?.isFavorite || false);
  }, [track?.isFavorite]);
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
  const handleToggleFavorite = () => {
    actions.toggleFavorite(track?.id || '');
    setIsFavorite(!isFavorite);
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
              <Badge key={index} variant="outline" className="capitalize border-none" size="xs">
                {genre}
              </Badge>
            ))}
          </div>
        )}
        {/* Metadata Grid */}
        <div className="flex flex-row gap-2">
          {[
            { icon: Clock, label: formatDuration(track.duration) },
            { icon: Activity, label: `${track.listeningCount} plays` },
            { icon: Music, label: `${formatBPM(track.mfTempo || 0)} BPM` },
            { icon: Zap, label: track.mfArousalMood },
            { icon: Activity, label: track.mfDanceabilityFeeling },
            {
              icon: getValenceIcon(track.mfValenceMood),
              label: track.mfValenceMood,
            },
          ].map((item, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-2 border-none capitalize"
              size="xs"
            >
              <item.icon size={64} />
              <span>{item.label}</span>
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-4">
        {/* Header Section */}
        <div className="flex items-start gap-6">
          {/* Album Art */}
          <div className="relative ">
            <div className="w-40 h-40 rounded-full overflow-hidden bg-muted flex items-center justify-center shadow-md hover:scale-105  duration-300">
              <img
                src={apiUrl(`/api/images/serve?imagePath=${track.imagePath}`)}
                alt="Album Art"
                className="w-full h-full object-cover  "
              />
            </div>
            <Button
              size="sm"
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full p-0 bg-secondary hover:bg-muted-foreground text-secondary-foreground"
              onClick={handlePlay}
            >
              {isThisTrackPlaying ? <Pause className="w-4 h-4 " /> : <Play className="w-4 h-4 " />}
            </Button>
          </div>

          {/* Track Info */}
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg  text-foreground truncate capitalize max-w-md ">
                {track.artist} - {track.title}
              </h1>
              <AudioQualityBadge format={track.format} hqAudioPath={track.hqAudioPath} />
            </div>

          </div>
          {/* Action Buttons */}
          <div className="flex flex-col items-end justify-center gap-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refetch}>
                <Dices className="w-4 h-4" />
                Next random
              </Button>{' '}
              <Button variant="ghost" size="sm" onClick={handleToggleFavorite}>
                <Heart className={cn('w-4 h-4', isFavorite ? 'fill-red-500 text-red-500' : '')} />
              </Button>{' '}
              <SelectPlaylistTrigger
                trackId={track.id}
                isDropdownMenuItem={false}
                artist={track.artist || ''}
                title={track.title || ''}
              />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-row justify-between items-center">
        {track.subgenres && track.subgenres.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {track.subgenres.map((subgenre, index) => (
              <Badge key={index} variant="secondary" className="capitalize" size="xs">
                {subgenre}
              </Badge>
            ))}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
