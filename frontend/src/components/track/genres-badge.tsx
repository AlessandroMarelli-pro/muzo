import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export const GenresBadge = ({
  genres,
  variant = 'outline',
}: {
  genres: string[];
  variant: 'outline' | 'secondary';
}) => {
  return (
    <div className="flex flex-row gap-2">
      {genres.length > 0 &&
        genres.slice(0, 2).map((genre, index) => (
          <Badge
            variant={variant}
            className="text-xs capitalize border-none"
            key={`${genre}-${index}`}
          >
            {genre}
          </Badge>
        ))}
      {genres.length > 2 && (
        <Tooltip>
          <TooltipTrigger>
            <Badge
              variant="default"
              className="text-xs capitalize border-none"
              key={'more-genres-badge'}
            >
              +{genres.length - 2}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{genres.slice(2).join(', ')}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
