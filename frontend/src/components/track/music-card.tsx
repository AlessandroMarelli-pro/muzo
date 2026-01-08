import { SimpleMusicTrack } from '@/__generated__/types';
import { Card } from '@/components/ui/card';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import { Pause, Play, Plus } from 'lucide-react';
import { memo, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { MusicCardContent } from './music-card-content';

interface MusicCardProps {
  track: SimpleMusicTrack;
  className?: string;
  onAdd?: (trackId: string) => void;
  setQueue: () => void;
  key: string;
  height?: string;
  width?: string;
}

function MusicCard({
  track,
  className,
  onAdd,
  setQueue,
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
    if (currentTrack?.id !== track.id) {
      setCurrentTrack(track);
    }
    setQueue();
    actions.togglePlayPause(track.id);
    e.stopPropagation();
  };

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        minWidth: `${width}px`,
        minHeight: `${height}px`,
        maxWidth: `${width}px`,
        maxHeight: `${height}px`,
      }}
      key={key}
    >
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
    </div>
  );
}

export default memo(MusicCard);
