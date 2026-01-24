import { SimpleMusicTrack } from '@/__generated__/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import { Pause, Play, Plus } from 'lucide-react';
import { memo, useRef } from 'react';
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
          <div className=" flex-1 h-5/8 backdrop-blur-md rounded-t-md flex items-center justify-center">
            <Skeleton className="w-2/3 h-2/3  " />
          </div>
          <div className=" space-y-2 p-2 z-1 bg-card rounded-b-md flex flex-col justify-between  h-3/8">
            <Skeleton className="w-full h-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
const HorizontalMusicCardListSkeleton = ({ numberOfCards = 4 }: { numberOfCards?: number }) => {
  return (
    <div className="flex-row  *:data-[slot=card]:shadow-   *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card  flex flex-nowrap gap-6 max-w-screen overflow-x-scroll scroll-mb-0 pb-3">
      {Array.from({ length: numberOfCards }).map((_, index) => (
        <MusicCardSkeleton key={index} />
      ))}
    </div>
  );
};
export const HorizontalMusicCardList = ({
  tracks,
  isLoading,
  emptyMessage = 'No tracks found',
  numberOfCards = 4,
}: {
  tracks: SimpleMusicTrack[];
  isLoading: boolean;
  emptyMessage?: string;
  numberOfCards?: number;
}) => {
  if (isLoading) return <HorizontalMusicCardListSkeleton numberOfCards={numberOfCards} />;
  return (
    <div className="pl-3 flex-row  *:data-[slot=card]:shadow-   *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card  flex flex-nowrap gap-6  overflow-x-scroll scroll-mb-0 pb-3">
      {tracks ? (
        tracks?.map((track, index) => (
          <MusicCard key={`${track.id}-${index}`} track={track} />
        ))
      ) : (
        <div>{emptyMessage}</div>
      )}
    </div>
  );
};


function MusicCard({
  track,
  className,
  onAdd,
  height = '300',
  width = '300',
}: MusicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();

  // Only check if this specific track is the current track and playing
  const isCurrentTrack = currentTrack?.id === track.id;
  const isThisTrackPlaying = isCurrentTrack && isPlaying;
  const trackId = track.id;
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
      key={`${trackId}-card`}
      className={cn(
        'relative h-full w-full',
        '   cursor-pointer',
        '  z-2',
        className,
        'py-0',
        'border-none',
      )}

      ref={cardRef}
    >
      <MusicCardContent
        track={track}
        showPlayButton={isThisTrackPlaying}
        playButton={
          <>
            <Button
              size="icon"
              variant="outline"
              className="z-1000 absolute bottom-2 left-2 border-none"

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
                size="icon"
                variant="outline"
                className="z-1000 absolute bottom-2 right-2 border-none bg-accent"


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
