import { Maybe, Track } from '@/__generated__/types';
import { cn, formatCoarseDuration, formatElapsed, isHarmonicTransition } from '@/lib/utils';
import { memo, useId, useMemo } from 'react';
import { Skeleton } from '../ui/skeleton';

/**
 * The tempo sketch — the set's BPM arc drawn in the margin of the sheet, the
 * way a DJ pencils the energy curve down the side of a cue sheet. A compact
 * sparkline, not a dashboard chart: it shows the shape of the mix and marks
 * the transitions that need attention.
 */

interface PlaylistDetailChartProps {
  tracks: Array<{
    position: number;
    track?: Maybe<Track>;
  }>;
  isLoading: boolean;
  /** Position of the currently-playing track, for the playhead marker. */
  currentPosition?: number;
  /** Click a point to jump the tracklist to that position. */
  onSeekToPosition?: (position: number) => void;
}

// A BPM jump larger than this between adjacent tracks is worth a caution mark.
const BPM_JUMP_CAUTION = 8;

interface Point {
  position: number;
  tempo: number;
  x: number; // 0..1 along the set (by cumulative time)
  y: number; // 0..1, higher tempo = higher
  cautionBefore: 'bpm' | 'key' | null;
}

function PlaylistDetailChartImpl({
  tracks,
  isLoading,
  currentPosition,
  onSeekToPosition,
}: PlaylistDetailChartProps) {
  const gradientId = useId();

  const { points, totalSec, bpmMin, bpmMax, cautionCount } = useMemo(() => {
    const rows = (tracks ?? []).filter((t) => t.track);
    const tempos = rows.map((r) => r.track?.mfTempo || 0);
    const withTempo = tempos.filter((t) => t > 0);
    const lo = withTempo.length ? Math.min(...withTempo) : 0;
    const hi = withTempo.length ? Math.max(...withTempo) : 1;
    const span = hi - lo || 1;

    let cum = 0;
    const durations = rows.map((r) => r.track?.duration || 0);
    const total = durations.reduce((a, b) => a + b, 0) || 1;

    let cautions = 0;
    const pts: Point[] = rows.map((r, i) => {
      const tempo = r.track?.mfTempo || 0;
      const x = cum / total;
      cum += durations[i];

      let cautionBefore: Point['cautionBefore'] = null;
      if (i > 0) {
        const prev = rows[i - 1].track;
        if (prev?.mfTempo && tempo && Math.abs(tempo - prev.mfTempo) >= BPM_JUMP_CAUTION) {
          cautionBefore = 'bpm';
        } else if (
          !isHarmonicTransition(
            prev?.mfCamelotKey ?? prev?.mfKey,
            r.track?.mfCamelotKey ?? r.track?.mfKey,
          )
        ) {
          cautionBefore = 'key';
        }
        if (cautionBefore) cautions += 1;
      }

      return {
        position: r.position,
        tempo,
        x,
        y: tempo > 0 ? (tempo - lo) / span : 0.5,
        cautionBefore,
      };
    });

    return { points: pts, totalSec: total, bpmMin: lo, bpmMax: hi, cautionCount: cautions };
  }, [tracks]);

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-lg" />;
  }
  if (points.length < 2) return null;

  const W = 1000;
  const H = 96;
  const padX = 4;
  const padY = 10;
  const iw = W - padX * 2;
  const ih = H - padY * 2;

  const px = (x: number) => padX + x * iw;
  const py = (y: number) => padY + (1 - y) * ih;

  // Smooth line (Catmull-Rom → bezier).
  const linePath = (() => {
    const p = points.map((pt) => [px(pt.x), py(pt.y)] as const);
    let d = `M ${p[0][0]} ${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
    }
    return d;
  })();

  const fillPath = `${linePath} L ${px(points[points.length - 1].x)} ${padY + ih} L ${px(
    points[0].x,
  )} ${padY + ih} Z`;

  // 5 elapsed-time labels along the bottom rule.
  const ticks = Array.from({ length: 5 }).map((_, i) => ({
    label: formatElapsed((totalSec * i) / 4),
  }));

  const current =
    currentPosition != null ? points.find((p) => p.position === currentPosition) : undefined;

  // Mark at most a handful of transitions on the sketch so it stays a legible
  // arc, not a picket fence. BPM jumps first (sharper problem), then key.
  const marked = (() => {
    const bpm = points.filter((p) => p.cautionBefore === 'bpm');
    const key = points.filter((p) => p.cautionBefore === 'key');
    return new Set([...bpm, ...key].slice(0, 6).map((p) => p.position));
  })();

  return (
    <figure className="rounded-lg border bg-card px-4 pt-3 pb-2">
      <figcaption className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tempo across the set
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {bpmMin > 0 ? `${Math.round(bpmMin)}–${Math.round(bpmMax)} BPM` : '—'}
          {' · '}
          {formatCoarseDuration(totalSec)}
        </span>
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 'clamp(80px, 11vh, 110px)' }}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Tempo ranges ${Math.round(bpmMin)} to ${Math.round(
            bpmMax,
          )} BPM across ${formatCoarseDuration(totalSec)}${
            cautionCount > 0
              ? `, with ${cautionCount} transition ${cautionCount === 1 ? 'caution' : 'cautions'}`
              : ''
          }.`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <line
            x1={padX}
            y1={padY + ih}
            x2={padX + iw}
            y2={padY + ih}
            stroke="var(--border)"
            strokeWidth={1}
          />

          <path d={fillPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1.75}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {points.map((pt) =>
            marked.has(pt.position) ? (
              <line
                key={`caution-${pt.position}`}
                x1={px(pt.x)}
                y1={padY + ih - 14}
                x2={px(pt.x)}
                y2={padY + ih}
                stroke="var(--destructive)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}

          {current && (
            <g>
              <line
                x1={px(current.x)}
                y1={padY}
                x2={px(current.x)}
                y2={padY + ih}
                stroke="var(--primary)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={px(current.x)}
                cy={py(current.y)}
                r={3}
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth={1.5}
              />
            </g>
          )}
        </svg>

        {/* seek hit-areas as real HTML buttons, overlaid on the sketch */}
        {onSeekToPosition && (
          <div className="absolute inset-0 flex">
            {points.map((pt) => (
              <button
                key={`hit-${pt.position}`}
                type="button"
                onClick={() => onSeekToPosition(pt.position)}
                aria-label={`Jump to track ${pt.position}`}
                tabIndex={-1}
                className="h-full flex-1 cursor-pointer"
              />
            ))}
          </div>
        )}
      </div>

      {/* time ticks — rendered as HTML so they stay crisp (the SVG is stretched) */}
      <div className="mt-1 flex justify-between font-mono text-xs tabular-nums text-muted-foreground">
        {ticks.map((t, i) => (
          <span key={`tick-${i}`}>{t.label}</span>
        ))}
      </div>

      {cautionCount > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5 text-destructive">
            <span aria-hidden className="inline-block h-2 w-2 rounded-[1px] bg-destructive" />
            {cautionCount} transition {cautionCount === 1 ? 'caution' : 'cautions'}
          </span>
          {(() => {
            const bpm = points.filter((p) => p.cautionBefore === 'bpm').length;
            const key = points.filter((p) => p.cautionBefore === 'key').length;
            return (
              <span className="text-muted-foreground">
                {[bpm && `${bpm} BPM jump${bpm === 1 ? '' : 's'}`, key && `${key} key clash${key === 1 ? '' : 'es'}`]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            );
          })()}
          {onSeekToPosition && (
            <>
              <span className="text-muted-foreground">— jump to:</span>
              {points
                .filter((p) => p.cautionBefore)
                .slice(0, 6)
                .map((p) => (
                  <button
                    key={`jump-${p.position}`}
                    type="button"
                    onClick={() => onSeekToPosition(p.position)}
                    title={
                      p.cautionBefore === 'bpm'
                        ? 'Big BPM jump into this track'
                        : 'Key clash before this track'
                    }
                    className={cn(
                      'rounded border px-1.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground',
                      'hover:border-destructive hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive',
                    )}
                  >
                    #{p.position}
                  </button>
                ))}
            </>
          )}
        </div>
      )}
    </figure>
  );
}

export const PlaylistDetailChart = memo(PlaylistDetailChartImpl);
