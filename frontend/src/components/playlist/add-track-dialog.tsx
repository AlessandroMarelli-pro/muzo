import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  const addTrackToPlaylistMutation = useAddTrackToPlaylist();
  if (isLoading) {
    return <Loading />;
  }

  const addTrackToPlaylist = async (trackId: string) => {
    addTrackToPlaylistMutation.mutate({
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

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        className="sm:max-w-[500px] "
        onInteractOutside={(e) => e.preventDefault()}
      >
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
              onAdd={addTrackToPlaylist}
              width="200"
              height="200"
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
