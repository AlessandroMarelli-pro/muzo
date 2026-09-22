import { PlaylistTrack, Track } from "@/__generated__/types";
import { Button } from "@/components/ui/button";
import { arousalMoodOptions } from "@/components/track/track-feature-options";
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from "@/contexts/audio-player-context";
import { apiUrl } from "@/lib/api-config";
import {
  capitalizeEveryWord,
  cn,
  formatGenreLine,
  formatTime,
  isHarmonicTransition,
  toCamelotCode,
} from "@/lib/utils";
import { useLookupBandcampUrl, useLookupDiscogsUrl } from "@/services/api-hooks";
import { Link } from "@tanstack/react-router";
import {
  AudioLines,
  Disc,
  Disc3,
  GripVertical,
  ListMusic,
  MoreHorizontal,
  Pause,
  Play,
  Radar,
  Sparkles,
  Trash2,
} from "lucide-react";
import { memo } from "react";
import { AudioQualityBadge } from "../track/audio-quality-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Skeleton } from "../ui/skeleton";

/** Album-art URL, or null when the track has no artwork (avoids a broken request). */
const albumArtUrl = (imagePath?: string | null) =>
  imagePath
    ? apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(imagePath)}`)
    : null;

const artistOf = (track?: Track | null) =>
  track?.artist ? capitalizeEveryWord(track.artist) : "Unknown artist";
const titleOf = (track?: Track | null) =>
  track?.title ? capitalizeEveryWord(track.title) : "Unknown title";
const trackLabel = (track?: Track | null) =>
  `${artistOf(track)} — ${titleOf(track)}`;

/** Energy is a 5-bucket mood string (very calm → very energetic); its index
 * in `arousalMoodOptions` doubles as a 1-5 meter level. */
const energyLevel = (mood?: string | null): number | null => {
  if (!mood) return null;
  const index = arousalMoodOptions.findIndex((o) => o.value === mood);
  return index === -1 ? null : index + 1;
};

/** Level → warmth. Derived from the single `--warning` token (the system has
 * no 5-step warm ramp) by mixing it toward the card surface, same hue at
 * graduated strength — cool/pale for calm, full warning-strength amber for
 * energetic. The whole bar takes on this step's colour (not just each tick
 * standing alone), so a calm track reads as a faint sliver and an energetic
 * one as a bold block at a glance. */
const ENERGY_MIX = [20, 40, 60, 80, 100];

/** Five ticks, filled left-to-right up to the current level — the same
 * glance-readable shorthand as the BPM/Key/Len readouts beside it. Unfilled
 * ticks stay `bg-muted`, same dark/quiet mark as an empty BPM or Key cell. */
function EnergyMeter({ mood }: { mood?: string | null }) {
  const level = energyLevel(mood);
  return (
    <div
      className="flex items-center justify-end gap-0.5"
      role="img"
      aria-label={
        level
          ? `Energy: ${arousalMoodOptions[level - 1].label}`
          : "Energy: unknown"
      }
      title={level ? arousalMoodOptions[level - 1].label : undefined}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "h-2.5 w-1 rounded-full",
            level && i < level ? undefined : "bg-muted",
          )}
          style={
            level && i < level
              ? {
                  backgroundColor: `color-mix(in oklab, var(--warning) ${ENERGY_MIX[level - 1]}%, var(--card))`,
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}

/**
 * The ledger's column template — shared by the header and every row, so they
 * stay aligned. Genres live inside the title cell (not their own column) and the
 * actions column is a FIXED width (reserved even while the buttons are hidden)
 * so nothing shifts between the header and the rows. Every grid also carries the
 * same 2px left border (transparent unless a transition needs a mark).
 */
export const LEDGER_GRID =
  "grid grid-cols-[1.75rem_2.5rem_minmax(0,1fr)_auto] md:grid-cols-[1.75rem_2.5rem_minmax(0,1fr)_3.25rem_3.5rem_2.75rem_3.75rem_9.5rem] items-center gap-x-3 border-l-2 border-l-transparent pl-3 pr-3";

export function PlaylistLedgerHeader() {
  return (
    <div
      className={cn(
        LEDGER_GRID,
        "border-b bg-card py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground",
      )}
    >
      <span className="text-right">#</span>
      <span aria-hidden />
      <span>Title / Artist</span>
      <span className="hidden text-right md:block">Energy</span>
      <span className="hidden text-right md:block">BPM</span>
      <span className="hidden text-right md:block">Key</span>
      <span className="hidden text-right md:block">Len</span>
      <span aria-hidden />
    </div>
  );
}

export const PlaylistTrackListCardSkeleton = ({
  position,
}: {
  position: number;
}) => {
  return (
    <div className={cn(LEDGER_GRID, "py-2.5")}>
      <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
        {position}
      </span>
      <Skeleton className="h-9 w-9 rounded" />
      <Skeleton className="h-4 w-2/3 rounded" />
      <Skeleton className="hidden h-2.5 w-8 justify-self-end rounded-full md:block" />
      <Skeleton className="hidden h-3.5 w-8 justify-self-end rounded md:block" />
      <Skeleton className="hidden h-3.5 w-8 justify-self-end rounded md:block" />
      <Skeleton className="hidden h-3.5 w-10 justify-self-end rounded md:block" />
      <span aria-hidden />
    </div>
  );
};

type TransitionKind = "bpm" | "key" | null;

function transitionBefore(
  prev?: Track | null,
  cur?: Track | null,
): TransitionKind {
  if (!prev || !cur) return null;
  if (prev.mfTempo && cur.mfTempo && Math.abs(cur.mfTempo - prev.mfTempo) >= 8)
    return "bpm";
  if (
    !isHarmonicTransition(
      prev.mfCamelotKey ?? prev.mfKey,
      cur.mfCamelotKey ?? cur.mfKey,
    )
  ) {
    return "key";
  }
  return null;
}

export const PlaylistTrackListCard = memo(
  ({
    playlistTrack,
    prevTrack,
    handleRemoveTrack,
    onAutomixFrom,
    removingTrackId: _removingTrackId,
    dragHandleProps,
    index: _index,
    playlistLength: _playlistLength,
  }: {
    playlistTrack: PlaylistTrack;
    prevTrack?: Track | null;
    handleRemoveTrack: (trackId: string) => void;
    onAutomixFrom: (seedTrackId: string) => void;
    removingTrackId: string | null;
    dragHandleProps?: any;
    index: number;
    playlistLength: number;
  }) => {
    const { currentTrack, setCurrentTrack } = useCurrentTrack();
    const actions = useAudioPlayerActions();
    const isPlaying = useIsPlaying();
    const lookupBandcampUrl = useLookupBandcampUrl();
    const lookupDiscogsUrl = useLookupDiscogsUrl();
    const track = playlistTrack.track ?? null;

    const isCurrentTrack = currentTrack?.id === track?.id;
    const isThisTrackPlaying = isCurrentTrack && isPlaying;

    const artUrl = albumArtUrl(track?.imagePath);
    const label = trackLabel(track);
    const tempo = track?.mfTempo;
    const rawKey = (track?.mfCamelotKey || track?.mfKey || "").trim();
    const camelot = toCamelotCode(rawKey);
    const genreLine = formatGenreLine(track?.genres, track?.subgenres);
    const transition = transitionBefore(prevTrack, track);

    const handlePlay = (e: React.SyntheticEvent<any>) => {
      e.stopPropagation();
      if (currentTrack?.id !== track?.id) {
        setCurrentTrack(track as Track);
        actions.play(track?.id || "");
      } else if (isThisTrackPlaying) {
        actions.pause(track?.id || "");
      } else {
        actions.play(track?.id || "");
      }
    };

    return (
      <div
        aria-current={isCurrentTrack ? "true" : undefined}
        data-current={isCurrentTrack ? "true" : undefined}
        title={
          transition === "bpm"
            ? "Big BPM jump from the previous track"
            : transition === "key"
              ? "Key clash with the previous track"
              : undefined
        }
        className={cn(
          LEDGER_GRID,
          "group py-2 transition-colors hover:bg-muted/50",
          // a hairline grease-pencil mark on rows whose transition needs attention
          transition && "border-l-destructive/60",
          isCurrentTrack && "border-l-primary bg-primary/5",
        )}
      >
        {/* # / drag handle */}
        <div className="flex items-center justify-end gap-1">
          {dragHandleProps ? (
            <button
              type="button"
              {...dragHandleProps}
              aria-label={`Reorder ${label}`}
              className="cursor-grab rounded-sm text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100 active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              isCurrentTrack ? "text-primary" : "text-muted-foreground",
            )}
          >
            {playlistTrack.position}
          </span>
        </div>

        {/* Art */}
        {artUrl ? (
          <img
            src={artUrl}
            alt=""
            width={36}
            height={36}
            loading="lazy"
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

        {/* Title / artist / genres */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {isThisTrackPlaying && (
              <AudioLines
                className="h-3.5 w-3.5 shrink-0 text-primary"
                aria-label="Now playing"
              />
            )}
            <span className="truncate text-sm font-medium">
              {titleOf(track)}
            </span>
            <AudioQualityBadge
              format={track?.format}
              hqAudioPath={track?.hqAudioPath}
            />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            <span>{artistOf(track)}</span>
            {genreLine && <span className="capitalize"> · {genreLine}</span>}
            {/* BPM/key inline on mobile where the columns are hidden */}
            <span className="font-mono tabular-nums md:hidden">
              {" · "}
              {tempo ? `${Math.round(tempo)}` : "—"} BPM
              {camelot ? ` · ${camelot}` : ""}
            </span>
          </p>
        </div>

        {/* Energy column */}
        <div className="hidden md:block">
          <EnergyMeter mood={track?.mfArousalMood} />
        </div>
        {/* BPM column */}
        <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
          {tempo ? Math.round(tempo) : "—"}
        </div>
        {/* Key column */}
        <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
          {camelot ??
            (rawKey ? <span title={rawKey}>{rawKey.split(" ")[0]}</span> : "—")}
        </div>
        {/* Length column */}
        <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
          {track?.duration ? formatTime(track.duration) : "—"}
        </div>

        {/* Actions — reserved lane, revealed on hover / when current */}
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
            variant="ghost"
            size="iconSm"
            onClick={(e) => {
              e.stopPropagation();
              onAutomixFrom(playlistTrack.id);
            }}
            aria-label={`Automix from ${label}`}
            title="Automix from here"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            className="text-destructive hover:text-destructive"
            onClick={() => handleRemoveTrack(track?.id || "")}
            aria-label={`Remove ${label} from playlist`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                onClick={(e) => e.stopPropagation()}
                aria-label={`More links for ${label}`}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link
                  to="/similar/{-$trackId}"
                  params={{ trackId: track?.id ?? "" }}
                  preload="intent"
                >
                  <Radar className="h-4 w-4" aria-hidden />
                  Similar tracks
                </Link>
              </DropdownMenuItem>
              {track?.bandcampUrl ? (
                <DropdownMenuItem asChild>
                  <a
                    href={track.bandcampUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Disc3 className="h-4 w-4" aria-hidden />
                    Open on Bandcamp
                  </a>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={() => {
                    if (track?.id) lookupBandcampUrl.mutate(track.id);
                  }}
                  disabled={lookupBandcampUrl.isPending}
                >
                  <Disc3
                    className={cn(
                      "h-4 w-4",
                      lookupBandcampUrl.isPending && "animate-spin",
                    )}
                    aria-hidden
                  />
                  Look up on Bandcamp
                </DropdownMenuItem>
              )}
              {track?.discogsUrl ? (
                <DropdownMenuItem asChild>
                  <a
                    href={track.discogsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Disc className="h-4 w-4" aria-hidden />
                    Open on Discogs
                  </a>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={() => {
                    if (track?.id) lookupDiscogsUrl.mutate(track.id);
                  }}
                  disabled={lookupDiscogsUrl.isPending}
                >
                  <Disc
                    className={cn(
                      "h-4 w-4",
                      lookupDiscogsUrl.isPending && "animate-spin",
                    )}
                    aria-hidden
                  />
                  Look up on Discogs
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  },
);
PlaylistTrackListCard.displayName = "PlaylistTrackListCard";
