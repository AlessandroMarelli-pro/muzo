import { PlaylistItem } from '@/__generated__/types';
import { cn } from '@/lib/utils';
import {
  useDeletePlaylist,
  useExportPlaylistToM3U,
} from '@/services/playlist-hooks';
import { Eye, MoreHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
// Note: This app uses custom view state instead of routing
// Navigation should be handled by parent component

interface PlaylistCardProps {
  playlist: PlaylistItem;
  onUpdate: () => void;
  onViewDetails: (playlistId: string) => void;
}

export function PlaylistCard({
  playlist,
  onUpdate,
  onViewDetails,
}: PlaylistCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const deletePlaylistMutation = useDeletePlaylist('default');
  const exportPlaylistMutation = useExportPlaylistToM3U('default');
  const [isHovered, setIsHovered] = useState(false);
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${playlist.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deletePlaylistMutation.mutateAsync(playlist.id);
      onUpdate();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePlay = () => {
    // TODO: Implement playlist playback
    console.log('Playing playlist:', playlist.id);
  };

  const handleEdit = () => {
    onViewDetails(playlist.id);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const m3uContent = await exportPlaylistMutation.mutateAsync(playlist.id);

      // Create a blob and download the file
      const blob = new Blob([m3uContent], { type: 'audio/mpegurl' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${playlist.name.replace(/[^a-z0-9]/gi, '_')}.m3u`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export playlist:', error);
      alert('Failed to export playlist. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  const images = playlist.images.slice(0, 4);

  return (
    <Card
      key={playlist.id}
      className="flex flex-col   rounded-none p-0 border-none bg-background gap-2 shadow-none"
    >
      <div
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        className=" flex justify-center items-center flex-wrap gap-0 p-0 max-w-60 max-h-60 min-w-60 min-h-60 shadow-md rounded-t-md hover:scale-105 transition-all duration-300"
      >
        {isHovered && (
          <AnimatePresence initial={false}>
            <motion.div
              className="absolute  items-center justify-center z-2 h-full w-full rounded-t-md flex"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <div className="absolute top-0 left-0 h-full w-full bg-background opacity-50 rounded-t-md" />
              <Button
                size="icon"
                variant="outline"
                className="z-1000 absolute bottom-2 left-2 "
                onClick={handleEdit}
              >
                <Eye className="h-5 w-5" />
              </Button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="z-1000 absolute bottom-2 right-2">
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="z-1000 "
                  side="bottom"
                >
                  <DropdownMenuItem onClick={handlePlay}>
                    Add to Queue
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExport}>
                    Add to Playlist
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleDelete}
                  >
                    Delete Playlist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          </AnimatePresence>
        )}
        {images.map((image, index) => (
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
              )}
            />
          </div>
        ))}
      </div>
      <CardContent className="p-0 h-full w-full bg-background border-none ">
        <div className="flex flex-col h-full space-around">
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
