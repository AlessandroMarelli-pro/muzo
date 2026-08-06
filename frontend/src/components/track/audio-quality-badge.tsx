import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const LOSSLESS_FORMATS = new Set(['flac', 'wav']);

export const isHqAudio = (format?: string | null, hqAudioPath?: string | null): boolean => {
  return !!hqAudioPath || LOSSLESS_FORMATS.has((format ?? '').toLowerCase());
};

export const AudioQualityBadge = ({
  format,
  hqAudioPath,
  className,
}: {
  format?: string | null;
  hqAudioPath?: string | null;
  className?: string;
}) => {
  if (!isHqAudio(format, hqAudioPath)) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="accent" size="xs" className={`border-none uppercase ${className ?? ''}`}>
          HQ
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Lossless audio available</TooltipContent>
    </Tooltip>
  );
};
