import { SimpleMusicTrack } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';

interface MusicCardContentProps {
  track: SimpleMusicTrack;
  showPlayButton?: boolean;
  onPlayClick?: (e: React.MouseEvent) => void;
  playButton?: React.ReactNode;
  className?: string;
}

export function MusicCardContent({
  track,
  showPlayButton,
  onPlayClick,
  playButton,
  className,
}: MusicCardContentProps) {
  const formattedTitle = track.title || 'Unknown Title';
  const formattedArtist = track.artist || 'Unknown Artist';
  const formattedGenres = track.genres && track.genres.length > 0 
    ? track.genres.join(', ') 
    : 'Unknown Genre';
  const formattedSubgenres = track.subgenres && track.subgenres.length > 0 
    ? track.subgenres.join(', ') 
    : 'Unknown Subgenre';
  const formattedImage = track.imagePath || 'Unknown Image';
  const bpm = track.tempo || 'Unknown BPM';

  return (
    <CardContent className={`p-0 ${className || ''}`}>
      {showPlayButton && playButton && (
        <div className="absolute flex items-center justify-center z-2 h-full w-full rounded-xl">
          <div className="absolute top-0 left-0 h-full w-full bg-primary/50 opacity-50 rounded-xl" />
          {playButton}
        </div>
      )}

      {/* Track Info */}
      <div className="space-y-1">
        <div className="w-full h-[60%] absolute">
          <div className="flex items-center justify-center h-full w-full">
            <img
              src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
              alt="Album Art"
              className="w-35 h-35 object-cover rounded-md z-1"
            />
          </div>
          <div className="z-0 absolute top-0 left-1/8 w-full h-full opacity-50 blur-md">
            <img
              src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
              alt="Album Art"
              className="w-55 h-75 object-cover rounded-md"
            />
          </div>
          <Badge
            variant="secondary"
            className="text-[11px] absolute bottom-0 right-1 z-1"
          >
            {bpm} bpm
          </Badge>
        </div>
        <div className="h-45" />
        <div className="space-y-2 p-2 z-1 h-full bg-background/90 rounded-xl flex flex-col justify-end backdrop-blur-sm">
          <div className="px-1">
            <h3
              className="font-semibold text-sm leading-tight line-clamp-1 capitalize"
              title={formattedTitle}
            >
              {formattedTitle}
            </h3>
            <p
              className="text-xs text-muted-foreground line-clamp-1 capitalize"
              title={formattedArtist}
            >
              {formattedArtist}
            </p>
          </div>
          {/* Genre and Subgenre */}
          <div className="flex flex-col flex-wrap gap-1">
            {formattedGenres !== 'Unknown Genre' && (
              <Badge variant="secondary" className="text-xs">
                {formattedGenres}
              </Badge>
            )}
            {formattedSubgenres !== 'Unknown Subgenre' && (
              <Badge variant="outline" className="text-xs">
                {formattedSubgenres}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </CardContent>
  );
}
