import { PlaylistItem } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useDeletePlaylist,
  useExportPlaylistToM3U,
} from '@/services/playlist-hooks';
import {
  AudioWaveform,
  Clock,
  Disc3,
  Download,
  Edit,
  HeartPlus,
  Play,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
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
    // TODO: Implement playlist editing
    console.log('Editing playlist:', playlist.id);
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

  return (
    <div
      key={playlist.id}
      className="flex items-center justify-between gap-4 p-0 bg-background/80  rounded-lg hover:bg-background/40 transition-colors hover:cursor-pointer"
    >
      <div className="flex items-center gap-4">
        <img
          src={`http://localhost:3000/api/images/serve?imagePath=${playlist.images[0]}`}
          alt="Album Art"
          className="w-25 h-25 object-cover rounded-xl "
        />
        {/* Track Info */}
        <div className="justify-between flex flex-col gap-2 ">
          <div className="font-medium truncate capitalize flex flex-row gap-1 items-center text-sm pl-1">
            {playlist.name}:
            <span className=" text-muted-foreground">
              {playlist.description}
            </span>
          </div>
          <div className="flex flex-row gap-1 items-center">
            <Badge variant="outline" className="text-xs ">
              <Disc3 className="h-4 w-4 " /> Tracks: {playlist.numberOfTracks}
            </Badge>
            <Badge variant="outline" className="text-xs ">
              <Clock className="h-4 w-4" />
              Duration: {formatDuration(playlist.totalDuration)}
            </Badge>{' '}
            <Badge variant="outline" className="text-xs ">
              <HeartPlus className="h-4 w-4 " /> BPM: {playlist.bpmRange.min} -{' '}
              {playlist.bpmRange.max}
            </Badge>
            <Badge variant="outline" className="text-xs ">
              <AudioWaveform className="h-4 w-4 " /> Energy:{' '}
              {playlist.energyRange.min} - {playlist.energyRange.max}
            </Badge>
          </div>
          <div className="flex flex-row gap-1">
            {playlist.topGenres.length > 0 && (
              <div className="flex flex-row gap-1">
                {playlist.topGenres.map((genre) => (
                  <Badge variant="secondary" className="text-xs ">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Track Details */}

      {/* Actions */}
      <div className="flex items-center gap-2 pr-2">
        <Button onClick={handlePlay} size="sm" variant="ghost">
          <Play className="h-4 w-4" />
          Play
        </Button>
        <Button onClick={handleEdit} size="sm" variant="ghost">
          <Edit className="h-4 w-4" />
          Edit
        </Button>
        <Button
          onClick={handleExport}
          size="sm"
          variant="ghost"
          disabled={isExporting}
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
        <Button onClick={handleDelete} size="sm" variant="ghost-destructive">
          <Trash2 />
          Delete
        </Button>
      </div>
    </div>
  );
}
