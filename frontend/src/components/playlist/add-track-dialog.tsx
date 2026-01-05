import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useQueue } from '@/contexts/audio-player-context';
import { useTracks } from '@/services/api-hooks';
import { useAddTrackToPlaylist } from '@/services/playlist-hooks';
import { FilterButton } from '../filters';
import { Loading } from '../loading';
import MusicCard from '../track/music-card';

interface AddTrackDialog {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  playlistId: string;
}

export function AddTrackDialog({
  open,
  onOpenChange,
  onSuccess,
  playlistId,
}: AddTrackDialog) {
  const { data: tracks = [], isLoading } = useTracks({});
  const addTrackMutation = useAddTrackToPlaylist();
  const { setQueue } = useQueue();
  if (isLoading) {
    return <Loading />;
  }

  const addTrack = async (trackId: string) => {
    addTrackMutation.mutate({
      playlistId,
      input: {
        trackId,
      },
    });

    onSuccess();
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const handleSetQueue = () => {
    setQueue(tracks);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-[500px] z-1000">
        <SheetHeader>
          <SheetTitle>Add Track to Playlist</SheetTitle>
          <SheetDescription>Add a track to your playlist.</SheetDescription>
        </SheetHeader>

        <div className="w-[80%] mx-auto">
          <FilterButton className="w-full" />
        </div>
        <div
          className={'flex flex-wrap  justify-center gap-3  overflow-y-auto'}
        >
          {tracks?.map((track) => (
            <MusicCard
              key={track.id}
              track={track}
              onAdd={addTrack}
              setQueue={handleSetQueue}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
