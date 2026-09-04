import { Playlist } from '@/__generated__/types';
import { apiUrl } from '@/lib/api-config';
import { cn } from '@/lib/utils';
import { usePlaylistActions } from '@/services/use-playlist-actions';
import { useRouter } from '@tanstack/react-router';
import { Eye } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { PlaylistActionsDialogs } from './playlist-actions-dialogs';
import { PlaylistActionsMenu } from './playlist-actions-menu';

const albumArtUrl = (imagePath?: string | null) =>
  imagePath ? apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(imagePath)}`) : undefined;
// Note: This app uses custom view state instead of routing
// Navigation should be handled by parent component

interface PlaylistCardProps {
  playlist: Playlist;
  onViewDetails?: (playlistId: string) => void;
  onCardClick?: (playlistId: string) => void;
}

export const PlaylistCardSkeleton = () => {
  return (
    <Card className="flex flex-col p-0 gap-0 ">
      <div className=" flex justify-center items-center flex-wrap p-0 max-w-60 max-h-60 min-w-60 min-h-60 rounded-t-md">
        <Skeleton className={cn('w-full h-full rounded-none rounded-t-md')} />
      </div>
      <CardContent className="p-2 h-full w-full  border-none gap-0">
        <div className="flex flex-col h-full space-around gap-2">
          <h3 className="text-xs font-semibold capitalize">
            <Skeleton className="w-1/2 h-4" />
          </h3>
          <div className="text-xs text-muted-foreground truncate capitalize">
            <Skeleton className="w-1/2 h-4" />
          </div>
          <div className="text-xs text-muted-foreground truncate capitalize">
            <Skeleton className="w-10 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export function PlaylistCard({ playlist, onViewDetails, onCardClick }: PlaylistCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();
  const refetch = () => router.invalidate();
  const actions = usePlaylistActions(playlist, { onDeleted: refetch, onChanged: refetch });

  const handleEdit = () => {
    onViewDetails?.(playlist.id);
  };

  const images = playlist.stats?.images?.slice(0, 4) || [];
  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(playlist.id);
    }
  };
  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (onCardClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onCardClick(playlist.id);
    }
  };
  return (
    <Card
      key={playlist.id}
      role={onCardClick ? 'button' : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      aria-label={onCardClick ? `Open playlist ${playlist.name}` : undefined}
      className={cn(
        'flex flex-col rounded-none p-0 border-none bg-background gap-2 shadow-none',
        onCardClick &&
          'cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      )}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      <div
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        className="  flex justify-center items-center flex-wrap gap-0 p-0 max-w-65 max-h-60 min-w-65 min-h-60 shadow-md rounded-t-md hover:scale-105 transition-[opacity,transform] duration-300"
      >
        <AnimatePresence initial={false}>
          {isHovered && (
            <motion.div
              className="absolute  items-center justify-center z-2 max-w-65 max-h-60 min-w-65 min-h-60 rounded-t-md flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <div className="absolute top-0 left-0 h-full w-full mask-t-from-0% mask-t-to-50% transition-[opacity,transform] duration-300 bg-background/90  rounded-t-md " />
              <Button
                size="icon"
                variant="outline"
                className="z-1000 absolute bottom-2 left-2 border-none"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit();
                }}
                aria-label={`Open playlist ${playlist.name}`}
              >
                <Eye className="h-5 w-5" aria-hidden />
              </Button>
              <PlaylistActionsMenu
                playlist={playlist}
                actions={actions}
                variant="card"
                triggerClassName="z-1000 absolute bottom-2 right-2"
                onTriggerClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {images.length === 4 ? (
          images.map((image, index) => (
            <div
              className="w-1/2 h-1/2 min-w-1/2 min-h-1/2 max-w-1/2 max-h-1/2 "
              key={playlist.id + index}
            >
              <img
                src={albumArtUrl(image)}
                alt=""
                width={120}
                height={120}
                loading="lazy"
                className={cn(
                  'w-full h-full object-cover  ',
                  index === 0 && 'rounded-tl-md',
                  index === 1 && 'rounded-tr-md',
                )}
              />
            </div>
          ))
        ) : (
          <div className="w-full h-full object-cover rounded-md" key={playlist.id}>
            <img
              src={albumArtUrl(images[0])}
              alt=""
              width={240}
              height={240}
              loading="lazy"
              className={cn('w-full h-full object-cover  rounded-t-md')}
            />
          </div>
        )}
      </div>
      <CardContent className="p-0 h-full w-full bg-background border-none ">
        <div className="flex flex-col h-full space-around">
          <h3 className="text-xs font-semibold">{playlist.name}</h3>
          {playlist.description && (
            <p className="text-xs text-muted-foreground truncate">{playlist.description}</p>
          )}
          <p className="text-xs text-muted-foreground truncate tabular-nums">
            {playlist.stats?.numberOfTracks ?? 0} tracks
          </p>
        </div>
      </CardContent>

      <PlaylistActionsDialogs playlist={playlist} actions={actions} onHqDialogClosed={refetch} />
    </Card>
  );
}
