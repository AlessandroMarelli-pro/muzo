import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { useTracks } from '@/services/api-hooks';
import { ListFilter } from 'lucide-react';
import { useState } from 'react';
import { FilterComponent } from '../filters/filter-component';
import MusicCard from '../track/music-card';
import { Button } from '../ui/button';

interface AddTrackDialog {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addTrackToPlaylist: (trackId: string) => void;
  playlistId: string;
}

export function AddTrackDialog({
  open,
  onOpenChange,
  addTrackToPlaylist,
}: AddTrackDialog) {
  const { data: tracks = [], isLoading } = useTracks({ orderBy: 'lastScannedAt', orderDirection: 'asc' });
  const [shouldDisplayFilter, setShouldDisplayFilter] = useState(false);
  const [divMaxWidth, setDivMaxWidth] = useState<number>(800);


  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };
  const handleDisplayFilter = () => {
    setDivMaxWidth(1200);
    setShouldDisplayFilter(true);
    console.log(divMaxWidth);
  };
  console.log(divMaxWidth);
  console.log(shouldDisplayFilter);
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        className={`sm:max-w-[${divMaxWidth}px]  `}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className='flex flex-row justify-start items-center gap-4'>
          <SheetTitle className='p-0 m-0'>Add Track to Playlist</SheetTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisplayFilter}
            className={`relative `}
          >
            <ListFilter className="h-4 w-4 mr-2" />
            Filters

          </Button>

        </SheetHeader>
        <div className='w-full flex flex-row gap-4'>
          {shouldDisplayFilter && (
            <FilterComponent className="w-full min-w-[300px]" />

          )}

          <div
            className={'flex flex-wrap  justify-center gap-5  overflow-y-scroll py-4 max-h-screen min-w-[600px]'}
          >
            {tracks?.map((track) => (
              <MusicCard
                key={track.id}
                track={track}
                onAdd={addTrackToPlaylist}
                width="235"
                height="200"
              />
            ))}
          </div>
        </div>

      </SheetContent>
    </Sheet>
  );
}
