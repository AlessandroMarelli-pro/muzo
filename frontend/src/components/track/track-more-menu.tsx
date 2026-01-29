import { useAddTrackToQueue } from "@/services/queue-hooks";
import { MoreHorizontal } from "lucide-react";
import { SelectPlaylistTrigger } from "../playlist/select-playlist-dialog";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

export const TrackMoreMenu = ({ trackId, }: { trackId: string, }) => {
    const addToQueueMutation = useAddTrackToQueue();
    const handleAddToQueue = () => {
        addToQueueMutation.mutate(trackId);
    }
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-5 w-5 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={handleAddToQueue}
                >
                    Add to Queue
                </DropdownMenuItem>
                <SelectPlaylistTrigger trackId={trackId} />
                <DropdownMenuItem>View Details</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}