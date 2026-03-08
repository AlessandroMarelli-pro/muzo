import { Track } from '@/__generated__/types';
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
  track: Track;
  className?: string;
  onAdd?: (trackId: string, artist: string, title: string) => void;
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
      className={cn('relative h-full w-full', '   cursor-pointer', '  z-2', 'py-0', 'border-none')}
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
  emptySubtext,
  numberOfCards = 4,
}: {
  tracks: Track[];
  isLoading: boolean;
  emptyMessage?: string;
  emptySubtext?: string;
  numberOfCards?: number;
}) => {
  if (isLoading) return <HorizontalMusicCardListSkeleton numberOfCards={numberOfCards} />;

  const hasTracks = Array.isArray(tracks) && tracks.length > 0;

  if (!hasTracks) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
        {emptySubtext && <p className="text-sm text-muted-foreground max-w-sm">{emptySubtext}</p>}
      </div>
    );
  }

  return (
    <div className="relative pl-3 pr-8">
      <div
        className="flex flex-nowrap gap-6 overflow-x-auto scroll-mb-0 pb-3 scroll-smooth [scrollbar-gutter:stable] *:data-[slot=card]:shadow"
        style={{ scrollbarWidth: 'thin' }}
      >
        {tracks.map((track, index) => (
          <MusicCard key={`${track.id}-${index}`} track={track} />
        ))}
      </div>
      {/* Scroll fade affordance */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-3 w-12 bg-gradient-to-l from-background to-transparent dark:from-background"
        aria-hidden
      />
    </div>
  );
};

function MusicCard({ track, className, onAdd, height = '250', width = '300' }: MusicCardProps) {
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
              aria-label={isThisTrackPlaying ? "Pause" : "Play"}
            >
              {isThisTrackPlaying ? (
                <Pause className="h-5 w-5" aria-hidden />
              ) : (
                <Play className="h-5 w-5" aria-hidden />
              )}
            </Button>
            {onAdd && (
              <Button
                size="icon"
                variant="outline"
                className="z-1000 absolute bottom-2 right-2 border-none bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(track.id, track.artist || '', track.title || '');
                }}
                aria-label="Add to playlist"
              >
                <Plus className="h-5 w-5" aria-hidden />
              </Button>
            )}
          </>
        }
      />
    </Card>
  );
}

export default memo(MusicCard);
