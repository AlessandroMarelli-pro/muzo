import { cn } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface WaveformVisualizerProps {
  /** Normalised peak amplitudes (0–1), one per sample column. */
  waveformData: number[];
  /** Track length in seconds. */
  duration: number;
  /** Beats per minute, if the track has been analysed — draws the beat grid. */
  bpm?: number | null;
  className?: string;
  /** True while the real peaks are still loading — renders a shimmer instead. */
  isLoading?: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const BAR_GAP = 1;
const BAR_WIDTH = 2;

/**
 * The waveform IS the scrubber. It renders the track's peak envelope split at
 * the playhead (played vs. unplayed), overlays a beat grid derived from BPM,
 * and takes click / drag / keyboard input to seek. Time readouts live on the
 * transport row, not here — this surface is the workspace, not a clock.
 */
export function WaveformVisualizer({
  waveformData,
  duration,
  bpm,
  className,
  isLoading = false,
  audioRef,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 0, h: 40 });
  const draggingRef = useRef(false);

  // Track playhead position from the audio element.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    audio.addEventListener('timeupdate', onTime);
    return () => audio.removeEventListener('timeupdate', onTime);
  }, [audioRef]);

  // Keep the canvas backing store matched to its rendered size (and DPR).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({
        w: Math.round(entry.contentRect.width),
        h: Math.round(entry.contentRect.height),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const seekTo = useCallback(
    (ratio: number) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const clamped = Math.min(1, Math.max(0, ratio));
      audio.currentTime = clamped * duration;
      setCurrentTime(clamped * duration);
    },
    [audioRef, duration],
  );

  const ratioFromEvent = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return (clientX - rect.left) / rect.width;
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    seekTo(ratioFromEvent(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const r = ratioFromEvent(e.clientX);
    setHoverRatio(r);
    if (draggingRef.current) seekTo(r);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!duration) return;
    const step = e.shiftKey ? 30 : 5;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      seekTo((currentTime + step) / duration);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      seekTo((currentTime - step) / duration);
    } else if (e.key === 'Home') {
      e.preventDefault();
      seekTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      seekTo(1);
    }
  };

  // Resample raw peaks to however many bars fit the current width.
  const bars = useMemo(() => {
    const count = Math.max(1, Math.floor(size.w / (BAR_WIDTH + BAR_GAP)));
    if (!waveformData.length) return new Array(count).fill(0.04);
    const out = new Array<number>(count);
    const bucket = waveformData.length / count;
    for (let i = 0; i < count; i++) {
      const start = Math.floor(i * bucket);
      const end = Math.max(start + 1, Math.floor((i + 1) * bucket));
      let peak = 0;
      for (let j = start; j < end && j < waveformData.length; j++) {
        const v = Math.abs(waveformData[j]);
        if (v > peak) peak = v;
      }
      out[i] = peak;
    }
    // Normalise so the loudest moment fills the height.
    const max = out.reduce((m, v) => Math.max(m, v), 0) || 1;
    return out.map((v) => v / max);
  }, [waveformData, size.w]);

  const progress = duration ? currentTime / duration : 0;

  // Paint.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.w, size.h);

    const style = getComputedStyle(canvas);
    const played = style.getPropertyValue('--wave-played').trim() || '#7c7fd6';
    const unplayed = style.getPropertyValue('--wave-unplayed').trim() || '#c9cad6';
    const grid = style.getPropertyValue('--wave-grid').trim() || 'rgba(124,127,214,0.16)';

    const mid = size.h / 2;
    const playedX = progress * size.w;

    // Phrase grid — short stubs at the top and bottom edge every 4 bars
    // (a 16-beat phrase), so structure reads without a picket fence.
    if (bpm && bpm > 0 && duration) {
      const secondsPerPhrase = (60 / bpm) * 16;
      // Skip if phrases would be closer than 24px apart — too dense to help.
      const phrasePx = (secondsPerPhrase / duration) * size.w;
      if (phrasePx >= 24) {
        ctx.strokeStyle = grid;
        ctx.lineWidth = 1;
        const stub = Math.max(3, size.h * 0.14);
        for (let t = secondsPerPhrase; t < duration; t += secondsPerPhrase) {
          const x = Math.round((t / duration) * size.w) + 0.5;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, stub);
          ctx.moveTo(x, size.h - stub);
          ctx.lineTo(x, size.h);
          ctx.stroke();
        }
      }
    }

    // Peak bars.
    for (let i = 0; i < bars.length; i++) {
      const x = i * (BAR_WIDTH + BAR_GAP);
      const amp = Math.max(0.03, bars[i]);
      const h = amp * (size.h - 4);
      ctx.fillStyle = x < playedX ? played : unplayed;
      ctx.fillRect(x, mid - h / 2, BAR_WIDTH, h);
    }

    // Playhead.
    if (duration) {
      ctx.fillStyle = played;
      ctx.fillRect(Math.round(playedX), 0, 1.5, size.h);
    }
  }, [bars, progress, size, bpm, duration]);

  const label = duration
    ? `Seek. ${Math.round(progress * 100)}% through the track.`
    : 'Seek';

  return (
    <div
      ref={wrapRef}
      role="slider"
      tabIndex={duration ? 0 : -1}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      aria-disabled={!duration}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setHoverRatio(null)}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative h-10 min-w-0 flex-1 cursor-pointer touch-none select-none rounded-md',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !duration && 'cursor-default opacity-60',
        className,
      )}
      style={
        {
          '--wave-played': 'var(--primary)',
          '--wave-unplayed': 'color-mix(in oklab, var(--muted-foreground) 55%, transparent)',
          '--wave-grid': 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)',
        } as React.CSSProperties
      }
    >
      {isLoading ? (
        <div className="absolute inset-0 overflow-hidden rounded-md">
          <div className="h-full w-full animate-pulse bg-[repeating-linear-gradient(90deg,color-mix(in_oklab,var(--muted-foreground)_22%,transparent)_0_2px,transparent_2px_5px)]" />
        </div>
      ) : (
        <canvas ref={canvasRef} className="block h-full w-full" style={{ width: size.w, height: size.h }} />
      )}

      {/* Hover scrub hint. */}
      {hoverRatio !== null && duration && !isLoading && (
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-foreground/30"
          style={{ left: `${Math.min(100, Math.max(0, hoverRatio * 100))}%` }}
        />
      )}
    </div>
  );
}
