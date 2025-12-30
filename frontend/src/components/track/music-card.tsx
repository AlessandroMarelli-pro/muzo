import { SimpleMusicTrack } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import { Pause, Play, Plus } from 'lucide-react';
import { memo, useRef, useState } from 'react';
import { Button } from '../ui/button';

interface MusicCardProps {
  track: SimpleMusicTrack;
  className?: string;
  onAdd?: (trackId: string) => void;
  setQueue: () => void;
}

function MusicCard({ track, className, onAdd, setQueue }: MusicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const formattedTitle = track.title || 'Unknown Title';
  const formattedArtist = track.artist || 'Unknown Artist';
  const formattedGenre = track.genre || 'Unknown Genre';
  const formattedSubgenre = track.subgenre || 'Unknown Subgenre';
  const formattedImage = track.imagePath || 'Unknown Image';
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();

  // Only check if this specific track is the current track and playing
  const isCurrentTrack = currentTrack?.id === track.id;
  const isThisTrackPlaying = isCurrentTrack && isPlaying;

  const bpm = track.tempo || 'Unknown BPM';

  const playMusic = (e: React.SyntheticEvent<any>) => {
    if (currentTrack?.id !== track.id) {
      setCurrentTrack(track);
    }
    setQueue();
    actions.togglePlayPause(track.id);
    e.stopPropagation();
  };

  return (
    <>
      <Card
        className={cn(
          'relative h-full w-full',
          '   cursor-pointer',
          'bg-background  z-2',
          className,
          'py-0',
          'border-none',
        )}
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        ref={cardRef}
      >
        <CardContent className="p-0">
          {(isHovered || isThisTrackPlaying) && (
            <div className="  absolute flex items-center justify-center z-1 h-full w-full rounded-xl">
              <div className="absolute top-0 left-0 h-full w-full bg-primary/50 opacity-50 rounded-xl" />
              <Button
                size="sm"
                disabled={false}
                variant="default"
                className={cn(
                  '   duration-200',
                  'h-12 w-12 rounded-full  shadow-lg  z-1000',
                )}
                onClick={playMusic}
              >
                {isThisTrackPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 " />
                )}
              </Button>
              {onAdd && (
                <Button
                  size="sm"
                  className={cn(
                    'duration-200',
                    'h-12 w-12 rounded-full bg-white hover:bg-white text-black shadow-lg z-1000',
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd(track.id);
                  }}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              )}
            </div>
          )}

          {/* Track Info */}
          <div className="space-y-1">
            <img
              src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
              alt="Album Art"
              className="w-full h-[60%] object-cover rounded-xl rounded-b-none absolute z-[-1]"
            />
            <div className="h-34 " />
            <div className="space-y-2 p-1 z-20 h-full bg-background rounded-xl flex flex-col justify-end shadow-[0px_-5px_10px_-3px_#2e2e2e] ">
              <div className="px-1">
                <h3
                  className="font-semibold text-sm leading-tight line-clamp-1 capitalize"
                  title={formattedTitle}
                >
                  {formattedTitle}
                </h3>
                <p
                  className="text-xs text-muted-foreground line-clamp-1 capitalize"
                  title={formattedArtist}
                >
                  {formattedArtist}
                </p>
              </div>
              {/* Genre and Subgenre */}
              <div className="flex flex-col flex-wrap gap-1 ">
                {formattedGenre && (
                  <Badge variant="secondary" className="text-[9px]">
                    {formattedGenre}
                  </Badge>
                )}
                {formattedSubgenre && (
                  <Badge variant="outline" className="text-[9px]">
                    {formattedSubgenre}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[9px] ">
                  {bpm} bpm
                </Badge>
              </div>
            </div>

            {/* Duration */}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default memo(MusicCard);
