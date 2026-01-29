import { SimpleMusicTrack } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

interface MusicCardContentProps {
  track: SimpleMusicTrack;
  showPlayButton?: boolean;
  playButton?: React.ReactNode;
  className?: string;
}

export function MusicCardContent({
  track,
  showPlayButton,
  playButton,
  className,
}: MusicCardContentProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formattedTitle = track.title || 'Unknown Title';
  const formattedArtist = track.artist || 'Unknown Artist';
  const formattedGenres =
    track.genres && track.genres.length > 0 ? track.genres : 'Unknown Genre';
  const formattedSubgenres =
    track.subgenres && track.subgenres.length > 0
      ? track.subgenres
      : 'Unknown Subgenre';
  const formattedImage = track.imagePath || 'Unknown Image';
  const trackId = track.id;
  return (
    <CardContent className={`p-0 ${className || ''} h-full`} key={`${trackId}-card-content`}>

      {/* Track Info */}
      <div className="flex flex-col h-full space-around">
        <div className="z-0 absolute  w-full h-full opacity-50 ">
          <img
            src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
            alt="Album Art"
            className=" object-fit rounded-md w-full h-full"
          />
        </div>
        <div className=" flex-1 h-5/8 backdrop-blur-md rounded-t-md" onMouseEnter={() => {
          setIsHovered(true);
        }}
          onMouseLeave={() => {
            setIsHovered(false);
          }}>
          {(
            <AnimatePresence initial={false}>
              {(isHovered || showPlayButton) && playButton && (
                <motion.div
                  className="absolute flex items-center justify-center z-2 h-full w-full rounded-md"
                  initial={{ opacity: 0, }}
                  animate={{ opacity: 1, }}
                  exit={{ opacity: 0, }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <div className="absolute top-0 left-0 h-full w-full mask-t-from-0% mask-t-to-50%  duration-300 bg-background/90  rounded-t-md" />
                  {playButton}
                </motion.div>
              )}
            </AnimatePresence>)}

          <div className="flex items-center justify-center h-full w-full ">
            <img
              src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
              alt="Album Art"
              className="w-2/3 h-2/3 object-cover rounded-md z-1"
            />
          </div>
        </div>
        <div className=" space-y-2 p-2 z-1 bg-card rounded-b-md flex flex-col justify-between  h-3/8">
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
          <div className="flex flex-row  gap-2 max-w-full overflow-x-scroll min-h-5">
            {formattedGenres !== 'Unknown Genre' &&
              formattedGenres.map((genre) => (
                <Badge variant="secondary" className="text-xs capitalize" key={`${trackId}-genre-${genre}`}>
                  {genre}
                </Badge>
              ))}
          </div>
          <div className="flex flex-row  gap-2 truncate ">
            {formattedSubgenres !== 'Unknown Subgenre' &&
              formattedSubgenres.map((subgenre) => (
                <Badge
                  variant="outline"
                  className="text-xs capitalize border-none"
                  key={`${trackId}-subgenre-${subgenre}`}
                >
                  {subgenre}
                </Badge>
              ))}
          </div>
        </div>
      </div>
    </CardContent>
  );
}
