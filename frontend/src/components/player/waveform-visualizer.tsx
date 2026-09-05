import { useIsPlaying } from '@/contexts/audio-player-context';
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
const BOUNDARY_SOFTEN_PX = 7;
const REVEAL_MS = 480;
const PLAYHEAD_LERP = 0.35;
const PULSE_RADIUS_BARS = 5;

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

interface DrawOptions {
  bars: number[];
  size: { w: number; h: number };
  progress: number;
  duration: number;
  bpm?: number | null;
  playheadX: number;
  revealProgress: number;
  pulsePhase: number;
  pulseActive: boolean;
  reducedMotion: boolean;
}

function drawWaveform(canvas: HTMLCanvasElement, opts: DrawOptions) {
  const { bars, size, duration, bpm, playheadX, revealProgress, pulsePhase, pulseActive, reducedMotion } = opts;
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

  // Peak bars. The played/unplayed boundary softens across a small window
  // around the playhead instead of hard-cutting per pixel, and (while
  // playing) the couple of bars nearest the playhead take a slight,
  // disciplined amplitude lift — a needle reading live, not a flicker.
  const barStep = BAR_WIDTH + BAR_GAP;
  const pulseWindowPx = PULSE_RADIUS_BARS * barStep;
  for (let i = 0; i < bars.length; i++) {
    const x = i * barStep;

    let reveal = 1;
    if (!reducedMotion && revealProgress < 1) {
      const barDelay = size.w > 0 ? x / size.w : 0;
      const local = (revealProgress - barDelay * 0.6) / 0.4;
      reveal = easeOutCubic(Math.min(1, Math.max(0, local)));
    }

    let amp = Math.max(0.03, bars[i]);
    if (pulseActive && !reducedMotion) {
      const dist = Math.abs(x - playheadX);
      if (dist <= pulseWindowPx) {
        const falloff = 1 - dist / pulseWindowPx;
        amp *= 1 + 0.05 * falloff * Math.sin(pulsePhase);
      }
    }

    const h = amp * (size.h - 4) * reveal;

    const dist = x - playheadX;
    if (dist < -BOUNDARY_SOFTEN_PX) {
      ctx.fillStyle = played;
    } else if (dist > BOUNDARY_SOFTEN_PX) {
      ctx.fillStyle = unplayed;
    } else {
      const t = (dist + BOUNDARY_SOFTEN_PX) / (BOUNDARY_SOFTEN_PX * 2);
      ctx.fillStyle = t < 0.5 ? played : unplayed;
    }
    ctx.fillRect(x, mid - h / 2, BAR_WIDTH, h);
  }

  // Playhead.
  if (duration) {
    ctx.fillStyle = played;
    ctx.fillRect(Math.round(playheadX), 0, 1.5, size.h);
  }
}

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
  const isPlaying = useIsPlaying();

  const reducedMotionRef = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    const onChange = () => {
      reducedMotionRef.current = mq.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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

  // "Print developing" bar entrance: when a new track's peaks land, sweep
  // them in left-to-right instead of popping in fully formed.
  const revealStartRef = useRef<number | null>(null);
  const prevWaveformRef = useRef<number[]>(waveformData);
  if (prevWaveformRef.current !== waveformData) {
    prevWaveformRef.current = waveformData;
    if (waveformData.length && !reducedMotionRef.current) {
      revealStartRef.current = performance.now();
    } else {
      revealStartRef.current = null;
    }
  }

  // Smoothed playhead x (lerped toward the true progress position) and the
  // live-pulse phase, both advanced every animation frame while playing.
  const displayXRef = useRef(0);
  const pulsePhaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;

    const reducedMotion = reducedMotionRef.current;
    let rafId: number | null = null;
    let lastFrame = performance.now();

    const revealProgressAt = (now: number) => {
      const start = revealStartRef.current;
      if (start === null) return 1;
      const t = Math.min(1, (now - start) / REVEAL_MS);
      if (t >= 1) revealStartRef.current = null;
      return t;
    };

    const renderFrame = (targetX: number, now: number) => {
      drawWaveform(canvas, {
        bars,
        size,
        progress,
        duration,
        bpm,
        playheadX: targetX,
        revealProgress: revealProgressAt(now),
        pulsePhase: pulsePhaseRef.current,
        pulseActive: isPlaying && !!duration,
        reducedMotion,
      });
    };

    const targetX = progress * size.w;

    if (reducedMotion || !isPlaying) {
      // No interpolation: land exactly on the real position and stop.
      displayXRef.current = targetX;
      renderFrame(targetX, performance.now());
      // Still let a bar-entrance sweep finish even when reduced motion is
      // off but playback isn't running (e.g. paint right after track load).
      if (revealStartRef.current !== null) {
        const tick = (now: number) => {
          renderFrame(targetX, now);
          if (revealStartRef.current !== null) rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      }
      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }

    const tick = (now: number) => {
      const dt = now - lastFrame;
      lastFrame = now;
      const live = duration ? (audioRef.current?.currentTime ?? currentTime) / duration : progress;
      const liveX = live * size.w;
      const lerpAmount = 1 - (1 - PLAYHEAD_LERP) ** (dt / 16.7);
      displayXRef.current += (liveX - displayXRef.current) * lerpAmount;
      pulsePhaseRef.current += dt * 0.006;
      renderFrame(displayXRef.current, now);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [bars, progress, size, bpm, duration, isPlaying, audioRef, currentTime]);

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
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-foreground/30 transition-[left] duration-100 ease-out motion-reduce:transition-none"
          style={{ left: `${Math.min(100, Math.max(0, hoverRatio * 100))}%` }}
        />
      )}
    </div>
  );
}
