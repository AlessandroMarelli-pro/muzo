import { SimpleMusicTrack } from '@/__generated__/types';
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
import { Skeleton } from '../ui/skeleton';
import { MusicCardContent } from './music-card-content';

interface MusicCardProps {
  track: SimpleMusicTrack;
  className?: string;
  onAdd?: (trackId: string) => void;
  key: string;
  height?: string;
  width?: string;
}
export function MusicCardSkeleton({
  width = '300',
  height = '300',
}: {
  width?: string;
  height?: string;
}) {
  return (
    <Card
      style={{
        width: `${width}px`,
        height: `${height}px`,
        minWidth: `${width}px`,
        minHeight: `${height}px`,
        maxWidth: `${width}px`,
        maxHeight: `${height}px`,
      }}
      className={cn(
        'relative h-full w-full',
        '   cursor-pointer',
        '  z-2',
        'py-0',
        'border-none',
      )}
    >
      <CardContent className="p-0 h-full">
        <div className="flex flex-col h-full space-around">
          <div className="z-0 absolute  w-full h-full opacity-50 ">
            <Skeleton className="w-full h-full" />
          </div>
          <div className=" flex-1 h-5/8 backdrop-blur-md rounded-md">
            <Skeleton className="w-full h-full" />
          </div>
          <div className=" space-y-2 p-2 z-1 bg-card rounded-md flex flex-col justify-between  h-3/8">
            <Skeleton className="w-full h-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MusicCard({
  track,
  className,
  onAdd,
  key,
  height = '300',
  width = '300',
}: MusicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();

  // Only check if this specific track is the current track and playing
  const isCurrentTrack = currentTrack?.id === track.id;
  const isThisTrackPlaying = isCurrentTrack && isPlaying;

  const playMusic = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    if (currentTrack?.id !== track.id) {
      setCurrentTrack(track);
      actions.play(track.id);
    } else {
      // Same track - toggle play/pause
      if (isThisTrackPlaying) {
        actions.pause(track.id);
      } else {
        actions.play(track.id);
      }
    }
  };

  return (
    <Card
      style={{
        width: `${width}px`,
        height: `${height}px`,
        minWidth: `${width}px`,
        minHeight: `${height}px`,
        maxWidth: `${width}px`,
        maxHeight: `${height}px`,
      }}
      key={key}
      className={cn(
        'relative h-full w-full',
        '   cursor-pointer',
        '  z-2',
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
      <MusicCardContent
        track={track}
        showPlayButton={isHovered || isThisTrackPlaying}
        playButton={
          <>
            <Button
              size="sm"
              disabled={false}
              variant="default"
              className={cn(
                'duration-200',
                'h-12 w-12 rounded-full shadow-lg z-1000',
              )}
              onClick={playMusic}
            >
              {isThisTrackPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
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
          </>
        }
      />
    </Card>
  );
}

export default memo(MusicCard);
