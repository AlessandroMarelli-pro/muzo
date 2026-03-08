import { Track } from '@/__generated__/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTracks } from '@/services/api-hooks';
import { ListFilter } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { FilterComponent } from '../filters/filter-component';
import MusicCard from '../track/music-card';
import { Button } from '../ui/button';

interface AddTrackDrawer {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addTrackToPlaylist: (trackId: string, artist: string, title: string) => void;
  playlistId: string;
}

export function AddTrackDrawer({ open, onOpenChange, addTrackToPlaylist }: AddTrackDrawer) {
  const { ref, inView } = useInView();

  const { data, isFetchingNextPage, hasNextPage, fetchNextPage } = useTracks({
    pagination: {
      direction: 'AFTER',
      size: 50,
    },
  });
  const pages = data?.pages;
  const tracks = pages?.flatMap((page) => page.items);
  const [shouldDisplayFilter, setShouldDisplayFilter] = useState(false);
  const [divMaxWidth, setDivMaxWidth] = useState<number>(800);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };
  const handleDisplayFilter = () => {
    setDivMaxWidth(1200);
    setShouldDisplayFilter(true);
  };

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        className={`sm:max-w-[${divMaxWidth}px]  `}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="flex flex-row justify-start items-center gap-4">
          <SheetTitle className="p-0 m-0">Add Track to Playlist</SheetTitle>
          <Button variant="outline" size="sm" onClick={handleDisplayFilter} className={`relative `}>
            <ListFilter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </SheetHeader>
        <div className="w-full flex flex-row gap-4">
          {shouldDisplayFilter && <FilterComponent className="w-full min-w-[300px]" />}
          <div className="max-h-[80vh] overflow-y-scroll">
            <div className={'flex flex-wrap  justify-center gap-5    py-4 min-w-[600px]'}>
              {tracks?.map((track) => (
                <MusicCard
                  key={track?.id || ''}
                  track={track as Track}
                  onAdd={addTrackToPlaylist}
                  width="235"
                  height="200"
                />
              ))}
            </div>
            <div className="flex justify-center">
              <Button
                ref={ref}
                className="w-1/2 bg-primary"
                size="lg"
                onClick={() => fetchNextPage()}
                disabled={!hasNextPage || isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Loading more…' : hasNextPage ? 'Load More' : null}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
