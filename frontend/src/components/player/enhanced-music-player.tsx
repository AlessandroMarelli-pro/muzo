import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useAudioPlayerActions,
  useAudioPlayerContext,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { usePlaybackProgressPublisher } from '@/contexts/playback-progress-context';
import { apiUrl } from '@/lib/api-config';
import { cn, formatTime } from '@/lib/utils';
import { useWaveformData } from '@/services/music-player-hooks';
import { useQueue } from '@/services/queue-hooks';
import { useNavigate } from '@tanstack/react-router';
import {
  Brain,
  Disc3,
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueueDrawer } from '../queue/queue-sidebar';
import { AudioQualityBadge } from '../track/audio-quality-badge';
import { TrackMoreMenu } from '../track/track-more-menu';
import { AlbumArt } from './album-art';
import { MUSIC_PLAYER_HEIGHT, MUSIC_PLAYER_HEIGHT_SM } from './player-constants';
import { WaveformVisualizer } from './waveform-visualizer';

interface EnhancedMusicPlayerProps {
  onToggleShuffle?: () => void;
  className?: string;
}

type RepeatMode = 'off' | 'all' | 'one';
const VOLUME_KEY = 'muzo.player.volume';
/** Tooltips that survive are informational — hold before showing them. */
const HINT_DELAY = 600;

/**
 * Small, evenly weighted transport button. The icon plus its `aria-label`
 * carry the meaning — no tooltip on these; they speak for themselves.
 */
function ControlButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="iconSm"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      className={cn('size-9', pressed && 'text-primary')}
    >
      {children}
    </Button>
  );
}

/**
 * Trim, then upper-case only the first letter. Enough to tidy a lower-case
 * tag ("daft punk" → "Daft punk") without re-casing the rest — interior
 * casing like "deadmau5", "RÜFÜS DU SOL" or "will.i.am" is left as tagged.
 */
function tidyMeta(value?: string | null): string {
  const v = (value ?? '').trim();
  return v ? v[0].toLocaleUpperCase() + v.slice(1) : '';
}

export const EnhancedMusicPlayer = React.memo(function EnhancedMusicPlayer({
  onToggleShuffle,
  className,
}: EnhancedMusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerBarRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { currentTrack } = useCurrentTrack();
  const { state: playbackState } = useAudioPlayerContext();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();
  const { data: queueItems = [] } = useQueue();

  const [queueOpen, setQueueOpen] = useState(false);
  // Seed with the CSS min-height so the queue panel docks correctly on the
  // very first open, before the ResizeObserver has reported a real height.
  const [playerBarHeight, setPlayerBarHeight] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 640 ? 72 : 88,
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // Publish the bar height on the document root while the player is mounted,
  // so surfaces portalled outside the app shell (e.g. a Sheet on <body>) can
  // stop short of the docked bar. Cleared on unmount — no track, no bar.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--music-player-height', MUSIC_PLAYER_HEIGHT);
    root.style.setProperty('--music-player-height-sm', MUSIC_PLAYER_HEIGHT_SM);
    return () => {
      root.style.removeProperty('--music-player-height');
      root.style.removeProperty('--music-player-height-sm');
    };
  }, []);

  // Restore the last-used volume once.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VOLUME_KEY);
      if (saved !== null) {
        const v = Math.min(1, Math.max(0, Number(saved)));
        if (!Number.isNaN(v)) setVolume(v);
      }
    } catch {
      /* storage unavailable — default volume is fine */
    }
  }, []);

  // Measure the bar so the queue drawer can dock exactly above it.
  useEffect(() => {
    const el = playerBarRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setPlayerBarHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentTrack]);

  // Stable queue position — distinguishes "first track" from "not in queue".
  const queueTracks = useMemo(
    () => queueItems.map((item) => item.track).filter((t): t is NonNullable<typeof t> => t != null),
    [queueItems],
  );
  const queueIndex = currentTrack ? queueTracks.findIndex((t) => t.id === currentTrack.id) : -1;
  const inQueue = queueIndex !== -1;
  const canPrevious = inQueue && queueIndex > 0;
  const canNext = inQueue && queueIndex < queueTracks.length - 1;

  // Reload the audio source when the track changes.
  useEffect(() => {
    if (audioRef.current && currentTrack) audioRef.current.load();
    setCurrentTime(0);
    setDuration(0);
  }, [currentTrack?.id]);

  // Reflect play/pause intent onto the element.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying && playbackState.trackId === currentTrack.id) {
      audio.play().catch((error) => {
        console.error('Error playing audio:', error);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, playbackState.trackId, currentTrack?.id]);

  // Apply volume / mute to the element.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted, currentTrack?.id]);

  const waveformId = currentTrack?.id ?? '';
  const { data: waveformData, isLoading: waveformLoading } = useWaveformData(waveformId);

  // Audio element events.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      if (canNext) {
        actions.next();
      } else if (repeatMode === 'all' && queueTracks.length > 0) {
        // Loop back to the first queued track.
        const first = queueTracks[0];
        if (first && first.id !== currentTrack?.id) actions.next();
      }
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [actions, repeatMode, canNext, queueTracks, currentTrack?.id]);

  const trackDuration = duration || currentTrack?.duration || 0;

  const handleSeekSlider = useCallback((value: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  }, []);

  // Mirror playback position into the shared context so surfaces above the
  // player bar (the add-track panel) can show progress and seek.
  const { setProgress, registerSeek } = usePlaybackProgressPublisher();
  useEffect(() => {
    registerSeek(handleSeekSlider);
  }, [registerSeek, handleSeekSlider]);
  useEffect(() => {
    setProgress({
      trackId: currentTrack?.id ?? null,
      currentTime,
      duration: trackDuration,
    });
  }, [setProgress, currentTrack?.id, currentTime, trackDuration]);

  const handleTogglePlay = useCallback(() => {
    if (!currentTrack) return;
    if (isPlaying) actions.pause(currentTrack.id);
    else actions.play(currentTrack.id);
  }, [currentTrack, isPlaying, actions]);

  const handleToggleFavorite = useCallback(() => {
    if (currentTrack) actions.toggleFavorite(currentTrack.id);
  }, [currentTrack, actions]);

  const cycleRepeat = () =>
    setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));

  const changeVolume = (v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolume(clamped);
    setMuted(clamped === 0);
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  };

  // Keyboard shortcuts — a DJ cycling hundreds of tracks lives on these.
  useEffect(() => {
    if (!currentTrack) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }
      const audio = audioRef.current;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          handleTogglePlay();
          break;
        case 'ArrowRight':
          if (e.shiftKey) {
            if (canNext) actions.next();
          } else if (audio) {
            audio.currentTime = Math.min(audio.currentTime + 5, trackDuration || audio.duration);
          }
          break;
        case 'ArrowLeft':
          if (e.shiftKey) {
            if (canPrevious) actions.previous();
          } else if (audio) {
            audio.currentTime = Math.max(audio.currentTime - 5, 0);
          }
          break;
        case 'f':
        case 'F':
          handleToggleFavorite();
          break;
        case 'm':
        case 'M':
          setMuted((v) => !v);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    currentTrack,
    handleTogglePlay,
    handleToggleFavorite,
    canNext,
    canPrevious,
    actions,
    trackDuration,
  ]);

  // Rendered once, as a sibling of whichever bar variant is on screen, so the
  // panel never remounts when a track loads or clears.
  const queueDrawer = (
    <QueueDrawer open={queueOpen} onOpenChange={setQueueOpen} offsetBottom={playerBarHeight} />
  );

  // Resting state — the bar stays docked with nothing loaded, so the surface
  // is always there and the queue drawer is reachable.
  if (!currentTrack) {
    return (
      <>
        <section
          ref={playerBarRef}
          aria-label="Music player"
          style={
            {
              '--music-player-height': MUSIC_PLAYER_HEIGHT,
              '--music-player-height-sm': MUSIC_PLAYER_HEIGHT_SM,
            } as React.CSSProperties
          }
          className={cn(
            'fixed inset-x-0 bottom-0 z-[var(--z-player)] flex items-center gap-3 border-t border-border bg-card px-4',
            'h-[var(--music-player-height-sm)] sm:h-[var(--music-player-height)]',
            className,
          )}
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-primary/40">
            <Disc3 className="size-5" strokeWidth={1.25} aria-hidden />
          </div>
          <p className="flex-1 truncate text-sm text-muted-foreground">
            Choose a track to start playing
          </p>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setQueueOpen((prev) => !prev)}
            className="relative size-9"
            aria-label="Toggle queue"
            aria-pressed={queueOpen}
          >
            <ListMusic className="size-4" aria-hidden />
            {queueItems.length > 0 && (
              <Badge
                variant="secondary"
                className="absolute -right-1.5 -top-1.5 h-4 min-w-4 justify-center px-1 text-xs leading-none tabular-nums"
              >
                {queueItems.length > 99 ? '99+' : queueItems.length}
              </Badge>
            )}
          </Button>
        </section>
        {queueDrawer}
      </>
    );
  }

  const bpm = currentTrack.mfTempo ? Math.round(currentTrack.mfTempo) : null;
  const musicalKey = currentTrack.mfCamelotKey || currentTrack.mfKey || null;
  const title = tidyMeta(currentTrack.title) || 'Unknown title';
  const artist = tidyMeta(currentTrack.artist) || 'Unknown artist';
  const primaryGenre = tidyMeta(currentTrack.genres?.[0]) || null;
  const isFavorite = !!playbackState?.isFavorite;

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

  return (
    <>
      <section
        ref={playerBarRef}
        aria-label="Music player"
        style={
          {
            '--music-player-height': MUSIC_PLAYER_HEIGHT,
            '--music-player-height-sm': MUSIC_PLAYER_HEIGHT_SM,
          } as React.CSSProperties
        }
        className={cn(
          'fixed inset-x-0 bottom-0 z-[var(--z-player)] isolate flex flex-col',
          'min-h-[var(--music-player-height-sm)] sm:min-h-[var(--music-player-height)]',
          'border-t border-border',
          className,
        )}
      >
        {/* Layered ground: solid card, then a quiet album-art wash over it. */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-card" />
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <AlbumArt
            imagePath={currentTrack.imagePath}
            decorative
            className="h-full w-full scale-125 opacity-25 blur-2xl"
          />
        </div>

        <div className="relative flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
          {/* ── Now playing ─────────────────────────────── */}
          <div className="flex min-w-0 items-center gap-3 sm:w-[280px] sm:shrink-0">
            <AlbumArt
              imagePath={currentTrack.imagePath}
              title={title}
              artist={artist}
              className="size-12 shrink-0 rounded-md sm:size-14"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {/* Delayed hint — only useful when the title is clipped. */}
                <Tooltip delayDuration={HINT_DELAY}>
                  <TooltipTrigger asChild>
                    <p className="truncate text-sm font-semibold leading-tight">{title}</p>
                  </TooltipTrigger>
                  <TooltipContent>{title}</TooltipContent>
                </Tooltip>
                <AudioQualityBadge
                  format={currentTrack.format}
                  hqAudioPath={currentTrack.hqAudioPath}
                />
              </div>
              <p className="truncate text-xs text-muted-foreground">{artist}</p>
              {/* The numbers a DJ actually mixes on. */}
              {(bpm || musicalKey || primaryGenre) && (
                <div className="mt-1 flex items-center gap-2 text-xs leading-none text-muted-foreground">
                  {bpm && <span className="font-mono tabular-nums">{bpm} BPM</span>}
                  {musicalKey && (
                    <>
                      <span aria-hidden className="opacity-40">
                        ·
                      </span>
                      <span className="font-mono">{musicalKey}</span>
                    </>
                  )}
                  {primaryGenre && (
                    <>
                      <span aria-hidden className="opacity-40">
                        ·
                      </span>
                      <span className="truncate">{primaryGenre}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Transport + waveform ────────────────────── */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {/* Primary transport */}
            <div className="flex shrink-0 items-center gap-0.5">
              <ControlButton
                label={canPrevious ? 'Previous track' : 'No previous track'}
                onClick={actions.previous}
                disabled={!canPrevious}
              >
                <SkipBack className="size-4" aria-hidden />
              </ControlButton>
              <Button
                variant="default"
                size="icon"
                onClick={handleTogglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                className="size-10 rounded-full"
              >
                {isPlaying ? (
                  <Pause className="size-5" aria-hidden />
                ) : (
                  <Play className="size-5 translate-x-[1px]" aria-hidden />
                )}
              </Button>
              <ControlButton
                label={canNext ? 'Next track' : 'No next track'}
                onClick={actions.next}
                disabled={!canNext}
              >
                <SkipForward className="size-4" aria-hidden />
              </ControlButton>
            </div>

            {/* Secondary playback options */}
            <div className="flex shrink-0 items-center gap-0.5 border-l border-border/60 pl-1.5 sm:pl-2">
              <ControlButton label="Shuffle queue" onClick={onToggleShuffle}>
                <Shuffle className="size-4" aria-hidden />
              </ControlButton>
              <ControlButton
                label={
                  repeatMode === 'off'
                    ? 'Repeat off'
                    : repeatMode === 'all'
                      ? 'Repeat queue'
                      : 'Repeat track'
                }
                onClick={cycleRepeat}
                pressed={repeatMode !== 'off'}
              >
                <RepeatIcon className="size-4" aria-hidden />
              </ControlButton>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="iconSm" className="size-9" aria-label="Volume">
                    <VolumeIcon className="size-4" aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  className="z-[var(--z-player-overlay)] flex h-40 w-auto flex-col items-center gap-3 px-3 py-4"
                >
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {Math.round((muted ? 0 : volume) * 100)}
                  </span>
                  <Slider
                    orientation="vertical"
                    value={[muted ? 0 : volume]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={([v]) => changeVolume(v)}
                    aria-label="Volume level"
                    className="flex-1"
                  />
                  <ControlButton
                    label={muted ? 'Unmute' : 'Mute'}
                    onClick={() => setMuted((v) => !v)}
                  >
                    {muted ? (
                      <VolumeX className="size-4" aria-hidden />
                    ) : (
                      <Volume1 className="size-4" aria-hidden />
                    )}
                  </ControlButton>
                </PopoverContent>
              </Popover>
            </div>

            {/* Waveform-as-scrubber — the workspace, desktop only. On narrow
              screens the compact slider below takes over. */}
            <span className="hidden w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground sm:inline">
              {formatTime(currentTime)}
            </span>
            <WaveformVisualizer
              waveformData={waveformData ?? []}
              duration={trackDuration}
              bpm={bpm}
              isLoading={waveformLoading || !waveformData}
              audioRef={audioRef}
              className="hidden sm:block"
            />
            <span className="hidden w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground sm:inline">
              {formatTime(trackDuration)}
            </span>
          </div>

          {/* ── Track actions ──────────────────────────── */}
          <div className="flex shrink-0 items-center gap-0.5 border-border/60 sm:border-l sm:pl-2">
            <ControlButton
              label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              onClick={handleToggleFavorite}
              pressed={isFavorite}
            >
              <Heart
                className={cn('size-4', isFavorite && 'fill-primary text-primary')}
                aria-hidden
              />
            </ControlButton>
            {/* Research is not self-evident from the icon — keep a delayed hint. */}
            <Tooltip delayDuration={HINT_DELAY}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={() => navigate({ to: `/research/${currentTrack.id}` })}
                  aria-label="Open research for this track"
                  className="size-9"
                >
                  <Brain className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Research this track</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => setQueueOpen((prev) => !prev)}
              className="relative size-9"
              aria-label="Toggle queue"
              aria-pressed={queueOpen}
            >
              <ListMusic className="size-4" aria-hidden />
              {queueItems.length > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute -right-1.5 -top-1.5 h-4 min-w-4 justify-center px-1 text-xs leading-none tabular-nums"
                >
                  {queueItems.length > 99 ? '99+' : queueItems.length}
                </Badge>
              )}
            </Button>
            <TrackMoreMenu
              trackId={currentTrack.id}
              artist={artist}
              title={title}
              format={currentTrack.format}
              hqAudioPath={currentTrack.hqAudioPath}
              imagePath={currentTrack.imagePath}
            />
          </div>
        </div>

        {/* Compact scrubber for narrow screens where the waveform is cramped. */}
        <div className="relative flex items-center gap-2 px-3 pb-2 sm:hidden">
          <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {formatTime(currentTime)}
          </span>
          <Slider
            value={[currentTime]}
            min={0}
            max={trackDuration || 0}
            step={1}
            onValueChange={([value]) => handleSeekSlider(value)}
            disabled={!trackDuration}
            aria-label="Seek"
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(trackDuration)}`}
            className="flex-1"
          />
          <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {formatTime(trackDuration)}
          </span>
        </div>

        <audio
          ref={audioRef}
          src={apiUrl(`/api/audio/stream/${currentTrack.id}`)}
          preload="metadata"
          className="hidden"
        />
      </section>
      {queueDrawer}
    </>
  );
});
