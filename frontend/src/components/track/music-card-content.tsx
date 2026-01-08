import { SimpleMusicTrack } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import { AnimatePresence, motion } from 'motion/react';

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
  const formattedGenres =
    track.genres && track.genres.length > 0 ? track.genres : 'Unknown Genre';
  const formattedSubgenres =
    track.subgenres && track.subgenres.length > 0
      ? track.subgenres
      : 'Unknown Subgenre';
  const formattedImage = track.imagePath || 'Unknown Image';
  const bpm = track.tempo || 'Unknown BPM';

  return (
    <CardContent className={`p-0 ${className || ''} h-full`}>
      <AnimatePresence initial={false}>
        {showPlayButton && playButton && (
          <motion.div
            className="absolute flex items-center justify-center z-2 h-full w-full rounded-xl"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="absolute top-0 left-0 h-full w-full bg-primary/50 opacity-50 rounded-xl" />
            {playButton}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Track Info */}
      <div className="flex flex-col h-full space-around">
        <div className="z-0 absolute top-0 left-1/8 w-full h-full opacity-50 blur-md">
          <img
            src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
            alt="Album Art"
            className="w-3/4 h-full object-cover rounded-md"
          />
        </div>
        <div className=" flex-1 h-5/8">
          <div className="flex items-center justify-center h-full w-full p-4">
            <img
              src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
              alt="Album Art"
              className="w-2/3 h-2/3 object-cover rounded-md z-1"
            />
          </div>
        </div>
        <div className=" space-y-2 p-2 z-1 bg-background/90 rounded-xl flex flex-col justify-between backdrop-blur-sm h-3/8">
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
          <div className="flex flex-row  gap-1">
            {formattedGenres !== 'Unknown Genre' &&
              formattedGenres.map((genre) => (
                <Badge variant="secondary" className="text-xs">
                  {genre}
                </Badge>
              ))}
          </div>
          <div className="flex flex-row  gap-1 truncate">
            {formattedSubgenres !== 'Unknown Subgenre' &&
              formattedSubgenres.map((subgenre) => (
                <Badge variant="outline" className="text-xs">
                  {subgenre}
                </Badge>
              ))}
          </div>
        </div>
      </div>
    </CardContent>
  );
}
