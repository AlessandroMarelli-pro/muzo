import { TrackRecommendation } from "@/__generated__/types";
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from "@/contexts/audio-player-context";
import { apiUrl } from "@/lib/api-config";
import {
  capitalizeEveryWord,
  cn,
  formatSimilarity,
  formatTime,
  toCamelotCode,
} from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { AudioLines, ListMusic, Pause, Play, Plus, Radar } from "lucide-react";
import { AudioQualityBadge } from "../track/audio-quality-badge";
import { TrackMoreMenu } from "../track/track-more-menu";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

/**
 * A recommendation, pencilled into the sheet: the ledger's columns plus a
 * one-line note on why the AI thinks it fits, and an ADD action in the gutter.
 */

const albumArtUrl = (imagePath?: string | null) =>
  imagePath
    ? apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(imagePath)}`)
    : null;

const REC_GRID =
  "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] md:grid-cols-[2.5rem_minmax(0,1fr)_3.5rem_2.75rem_3.75rem_7.5rem] items-center gap-x-3 border-l-2 border-l-transparent pl-3 pr-3";

export function TrackRecommendationsHeader() {
  return (
    <div
      className={cn(
        REC_GRID,
        "border-b bg-card py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground",
      )}
    >
      <span aria-hidden />
      <span>Title / Artist — why it fits</span>
      <span className="hidden text-right md:block">BPM</span>
      <span className="hidden text-right md:block">Key</span>
      <span className="hidden text-right md:block">Len</span>
      <span aria-hidden />
    </div>
  );
}

export const TrackRecommendationsCardSkeleton = ({
  index,
}: {
  index: number;
}) => {
  return (
    <div
      key={`skeleton-recommendations-card-${index}`}
      className={cn(REC_GRID, "py-2.5")}
    >
      <Skeleton className="h-9 w-9 rounded" />
      <div className="min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="hidden h-3.5 w-8 justify-self-end md:block" />
      <Skeleton className="hidden h-3.5 w-8 justify-self-end md:block" />
      <Skeleton className="hidden h-3.5 w-10 justify-self-end md:block" />
      <span aria-hidden />
    </div>
  );
};

export const TrackRecommendationsCard = ({
  recommendation,
  onAddTrack,
  added = false,
}: {
  recommendation: TrackRecommendation;
  onAddTrack?: (trackId: string, artist: string, title: string) => void;
  index?: number;
  recommendationsLength?: number;
  /** True once added — the row greys out instead of vanishing. */
  added?: boolean;
}) => {
  const track = recommendation.track;
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();
  const navigate = useNavigate();

  const isCurrentTrack = currentTrack?.id === track.id;
  const isThisTrackPlaying = isCurrentTrack && isPlaying;

  const artUrl = albumArtUrl(track.imagePath);
  const artist = track.artist
    ? capitalizeEveryWord(track.artist)
    : "Unknown artist";
  const title = track.title
    ? capitalizeEveryWord(track.title)
    : "Unknown track";
  const label = `${artist} — ${title}`;
  const camelot = toCamelotCode(track.mfCamelotKey || track.mfKey);
  const why = recommendation.reasons?.[0]
    ? capitalizeEveryWord(recommendation.reasons[0])
    : `${formatSimilarity(recommendation.similarity)} match`;

  const handlePlay = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    if (currentTrack?.id !== track.id) {
      setCurrentTrack(track);
      actions.play(track.id);
    } else if (isThisTrackPlaying) {
      actions.pause(track.id);
    } else {
      actions.play(track.id);
    }
  };
  const handleAddTrack = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    onAddTrack?.(track.id, track.artist || "", track.title || "");
  };
  const handleSimilar = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    navigate({ to: `/similar/${track.id}` });
  };

  return (
    <div
      aria-current={isCurrentTrack ? "true" : undefined}
      data-current={isCurrentTrack ? "true" : undefined}
      className={cn(
        REC_GRID,
        "group py-2 transition-colors hover:bg-muted/50",
        isCurrentTrack && "border-l-primary bg-primary/5",
        added && "opacity-40",
      )}
    >
      {artUrl ? (
        <img
          src={artUrl}
          alt=""
          loading="lazy"
          width={36}
          height={36}
          className="h-9 w-9 rounded object-cover"
        />
      ) : (
        <div
          className="flex h-9 w-9 items-center justify-center rounded bg-muted"
          aria-hidden
        >
          <ListMusic className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {isThisTrackPlaying && (
            <AudioLines
              className="h-3.5 w-3.5 shrink-0 text-primary"
              aria-label="Now playing"
            />
          )}
          <span className="truncate text-sm font-medium">{title}</span>
          <AudioQualityBadge
            format={track.format}
            hqAudioPath={track.hqAudioPath}
          />
        </div>
        <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <span className="truncate">{artist}</span>
          <span className="shrink-0 text-border">·</span>
          <span className="truncate italic">{why}</span>
          <span className="shrink-0 font-mono tabular-nums md:hidden">
            · {track.mfTempo ? Math.round(track.mfTempo) : "—"} BPM
            {camelot ? ` · ${camelot}` : ""}
          </span>
        </div>
      </div>

      <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
        {track.mfTempo ? Math.round(track.mfTempo) : "—"}
      </div>
      <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
        {camelot ?? "—"}
      </div>
      <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
        {track.duration ? formatTime(track.duration) : "—"}
      </div>

      <div className="flex items-center justify-end gap-4 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-data-[current=true]:opacity-100">
        <Button
          variant="ghost"
          size="iconSm"
          onClick={handlePlay}
          aria-label={isThisTrackPlaying ? `Pause ${label}` : `Play ${label}`}
        >
          {isThisTrackPlaying ? (
            <Pause className="h-4 w-4" aria-hidden />
          ) : (
            <Play className="h-4 w-4 translate-x-px" aria-hidden />
          )}
        </Button>
        <Button
          size="iconSm"
          onClick={handleSimilar}
          variant="ghost"
          aria-label={`Find similar to ${label}`}
        >
          <Radar className="h-4 w-4" aria-hidden />
        </Button>
        {onAddTrack ? (
          <Button
            size="iconSm"
            onClick={handleAddTrack}
            variant="ghost"
            disabled={added}
            aria-label={added ? `${label} added` : `Add ${label} to playlist`}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <TrackMoreMenu
            trackId={track.id}
            artist={track.artist || "Unknown Artist"}
            title={track.title || "Unknown Track"}
            format={track.format}
            hqAudioPath={track.hqAudioPath}
            imagePath={track.imagePath}
          />
        )}
      </div>
    </div>
  );
};
