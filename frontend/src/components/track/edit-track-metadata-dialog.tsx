import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useUpdateTrackMetadata } from "@/services/api-hooks";
import { useEffect, useState } from "react";

export const EditTrackMetadataDialog = ({
  trackId,
  artist,
  title,
  open,
  onOpenChange,
}: {
  trackId: string;
  artist: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [artistValue, setArtistValue] = useState(artist);
  const [titleValue, setTitleValue] = useState(title);
  const updateTrackMetadataMutation = useUpdateTrackMetadata();

  useEffect(() => {
    if (open) {
      setArtistValue(artist);
      setTitleValue(title);
    }
  }, [open, artist, title]);

  const handleSubmit = () => {
    updateTrackMetadataMutation.mutate(
      { trackId, artist: artistValue.trim(), title: titleValue.trim() },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit artist / title</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-track-artist">Artist</Label>
            <Input
              id="edit-track-artist"
              value={artistValue}
              onChange={(e) => setArtistValue(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-track-title">Title</Label>
            <Input
              id="edit-track-title"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateTrackMetadataMutation.isPending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
