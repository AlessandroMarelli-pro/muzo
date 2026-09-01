import { Track } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    <Card>
      <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Skeleton className="h-44 w-44 shrink-0 rounded-full" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-7 w-64" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-16 rounded-full" />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-20 rounded-full" />
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>
      </CardContent>
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
    } else if (isPlaying) {
      actions.pause(track?.id || '');
    } else {
      actions.play(track?.id || '');
    }
  };

  const handleToggleFavorite = () => {
    actions.toggleFavorite(track?.id || '');
    setIsFavorite(!isFavorite);
  };

  if (isLoading || !track) {
    return <DetailedTrackCardSkeleton />;
  }

  const features = [
    { icon: Clock, label: formatDuration(track.duration) },
    { icon: Activity, label: `${track.listeningCount} plays` },
    { icon: Music, label: `${formatBPM(track.mfTempo || 0)} BPM` },
    { icon: Zap, label: track.mfArousalMood },
    { icon: Activity, label: track.mfDanceabilityFeeling },
    { icon: getValenceIcon(track.mfValenceMood), label: track.mfValenceMood },
  ].filter((f) => f.label);

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Album art — the signature circular disc, focal element of the page */}
        <div className="group relative mx-auto shrink-0 sm:mx-0">
          <div className="h-44 w-44 overflow-hidden rounded-full bg-muted shadow-md transition-transform duration-300 group-hover:scale-105">
            <img
              src={apiUrl(`/api/images/serve?imagePath=${track.imagePath}`)}
              alt={`${track.artist} — ${track.title}`}
              className="h-full w-full object-cover"
            />
          </div>
          <Button
            size="icon"
            onClick={handlePlay}
            aria-label={isThisTrackPlaying ? 'Pause' : 'Play'}
            className="absolute right-2 bottom-2 h-11 w-11 rounded-full shadow-sm active:scale-95"
          >
            {isThisTrackPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 translate-x-px" />
            )}
          </Button>
        </div>

        {/* Track detail — stacked tiers, title leads */}
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-balance capitalize sm:text-2xl">
              {track.artist} — {track.title}
            </h2>
            <AudioQualityBadge format={track.format} hqAudioPath={track.hqAudioPath} />
          </div>

          {((track.genres && track.genres.length > 0) ||
            (track.subgenres && track.subgenres.length > 0)) && (
            <div className="flex flex-wrap gap-1.5">
              {track.genres?.map((genre) => (
                <Badge key={`g-${genre}`} variant="secondary" size="xs" className="capitalize">
                  {genre}
                </Badge>
              ))}
              {track.subgenres?.map((subgenre) => (
                <Badge key={`s-${subgenre}`} variant="outline" size="xs" className="capitalize">
                  {subgenre}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {features.map((item, index) => (
              <Badge key={index} variant="secondary" size="xs" className="gap-1.5 capitalize">
                <item.icon className="h-3 w-3" />
                <span>{item.label}</span>
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={refetch}>
              <Dices className="h-4 w-4" />
              Next random
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleFavorite}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={cn('h-4 w-4', isFavorite && 'fill-red-500 text-red-500')} />
            </Button>
            <SelectPlaylistTrigger
              trackId={track.id}
              isDropdownMenuItem={false}
              artist={track.artist || ''}
              title={track.title || ''}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
