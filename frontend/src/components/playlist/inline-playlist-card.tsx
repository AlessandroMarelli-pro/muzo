import { PlaylistItem } from '@/__generated__/types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
// Note: This app uses custom view state instead of routing
// Navigation should be handled by parent component

interface InlinePlaylistCardProps {
  playlist: PlaylistItem & { disabled?: boolean };
  onCardClick?: (playlistId: string) => void;
}

export const InlinePlaylistCardSkeleton = () => {
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

export function InlinePlaylistCard({
  playlist,
  onCardClick,
}: InlinePlaylistCardProps) {

  const disabled = playlist.isTrackInPlaylist;
  const images = playlist.images.slice(0, 4);
  const handleCardClick = () => {
    if (onCardClick && !disabled) {
      onCardClick(playlist.id);
    }
  };
  return (
    <Card
      key={playlist.id}
      className={cn("flex flex-row  bg-background  p-2 border-none  gap-4 shadow-none ",
        onCardClick && 'cursor-pointer',
        disabled ? ' cursor-not-allowed opacity-50' : ' hover:bg-accent')}
      onClick={handleCardClick}
    >
      <div

        className="  flex justify-center items-center flex-wrap gap-0 p-0 max-w-16 max-h-16 min-w-16 min-h-16 shadow-md  hover:scale-105 transition-all duration-300"
      >

        {images.length === 4 ? images.map((image, index) => (
          <div
            className="w-1/2 h-1/2 min-w-1/2 min-h-1/2 max-w-1/2 max-h-1/2 "
            key={playlist.id + index}
          >
            <img
              src={`http://localhost:3000/api/images/serve?imagePath=${image}`}
              alt="Album Art"
              className={cn(
                'w-full h-full object-cover  ',
                index === 0 && 'rounded-tl-md',
                index === 1 && 'rounded-tr-md',
                index === 2 && 'rounded-bl-md',
                index === 3 && 'rounded-br-md',
              )}
            />
          </div>
        )) : <div
          className="w-full h-full object-cover rounded-md"
          key={playlist.id}
        >
          <img
            src={`http://localhost:3000/api/images/serve?imagePath=${images[0]}`}
            alt="Album Art"
            className={cn(
              'w-full h-full object-cover  rounded-md',

            )}
          />
        </div>}
      </div>
      <CardContent className="p-0 h-full w-full  border-none ">
        <div className="flex flex-col h-full space-around gap-1">
          <h3 className="text-xs font-semibold capitalize">{playlist.name}</h3>
          <p className="text-xs text-muted-foreground truncate capitalize">
            {playlist.description}
          </p>
          <p className="text-xs text-muted-foreground truncate capitalize">
            {playlist.numberOfTracks} tracks
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
