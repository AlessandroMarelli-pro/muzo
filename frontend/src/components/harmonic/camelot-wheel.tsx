import { CAMELOT_KEYS, getCompatibleKeys, normalizeCamelot } from '@/lib/camelot';
import { cn } from '@/lib/utils';
import * as React from 'react';

interface CamelotWheelProps {
  /** Currently selected key code, e.g. "8A". */
  selected?: string | null;
  onSelect: (code: string) => void;
  className?: string;
}

const SIZE = 320;
const CENTER = SIZE / 2;
const OUTER_R = 156; // minor ring outer edge
const MID_R = 108; // boundary between minor (outer) and major (inner)
const INNER_R = 60; // major ring inner edge
const LABEL_R_MINOR = (OUTER_R + MID_R) / 2;
const LABEL_R_MAJOR = (MID_R + INNER_R) / 2;

/** Polar → cartesian. Angle 0 = 12 o'clock, growing clockwise. */
function pointOnCircle(radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function segmentPath(rInner: number, rOuter: number, startAngle: number, endAngle: number) {
  const p1 = pointOnCircle(rOuter, startAngle);
  const p2 = pointOnCircle(rOuter, endAngle);
  const p3 = pointOnCircle(rInner, endAngle);
  const p4 = pointOnCircle(rInner, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

/**
 * The Camelot wheel. Outer ring = minor keys (A), inner ring = major (B),
 * clock positions 1–12 clockwise from the top. Click a segment to select it;
 * harmonically compatible keys stay lit, everything else dims.
 *
 * The traditional per-position hues live only here (see DESIGN.md — the one
 * screen where multi-hue is the domain content).
 */
export function CamelotWheel({ selected, onSelect, className }: CamelotWheelProps) {
  const selectedCode = normalizeCamelot(selected);
  const compatible = React.useMemo(
    () => new Set(getCompatibleKeys(selectedCode)),
    [selectedCode],
  );

  const anglePer = 360 / 12;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={cn('h-auto w-full max-w-[360px] select-none', className)}
      role="group"
      aria-label="Camelot wheel — pick a key to see compatible keys"
    >
      {CAMELOT_KEYS.map((key) => {
        const isMinor = key.letter === 'A';
        const rInner = isMinor ? MID_R : INNER_R;
        const rOuter = isMinor ? OUTER_R : MID_R;
        // Position 12 sits at the top; position 1 is one step clockwise.
        const centerAngle = (key.number % 12) * anglePer;
        const startAngle = centerAngle - anglePer / 2;
        const endAngle = centerAngle + anglePer / 2;
        const labelPos = pointOnCircle(isMinor ? LABEL_R_MINOR : LABEL_R_MAJOR, centerAngle);

        const isSelected = selectedCode === key.code;
        const isCompatible = compatible.has(key.code);
        const dimmed = selectedCode != null && !isSelected && !isCompatible;

        return (
          <g key={key.code}>
            <path
              d={segmentPath(rInner, rOuter, startAngle, endAngle)}
              fill={key.color}
              className={cn(
                'cursor-pointer transition-opacity outline-none',
                dimmed ? 'opacity-20' : 'opacity-100',
                'hover:opacity-90 focus-visible:opacity-90',
              )}
              stroke="var(--background)"
              strokeWidth={2}
              tabIndex={0}
              role="button"
              aria-pressed={isSelected}
              aria-label={`${key.code} — ${key.name}`}
              onClick={() => onSelect(key.code)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(key.code);
                }
              }}
            />
            <text
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="central"
              className={cn(
                'pointer-events-none font-mono',
                isMinor ? 'text-[11px]' : 'text-[10px]',
                isSelected && 'font-semibold',
                dimmed ? 'opacity-55' : 'opacity-100',
              )}
              fill="var(--foreground)"
            >
              {key.code}
            </text>
          </g>
        );
      })}

      {/* Selected-key outline, drawn on top so no neighbour clips it. */}
      {selectedCode != null &&
        (() => {
          const key = CAMELOT_KEYS.find((k) => k.code === selectedCode);
          if (!key) return null;
          const isMinor = key.letter === 'A';
          const rInner = isMinor ? MID_R : INNER_R;
          const rOuter = isMinor ? OUTER_R : MID_R;
          const centerAngle = (key.number % 12) * anglePer;
          return (
            <path
              d={segmentPath(rInner + 2, rOuter - 2, centerAngle - anglePer / 2, centerAngle + anglePer / 2)}
              fill="none"
              stroke="var(--ring)"
              strokeWidth={4}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          );
        })()}

      <text
        x={CENTER}
        y={CENTER}
        textAnchor="middle"
        dominantBaseline="central"
        className="pointer-events-none text-[11px]"
        fill="var(--muted-foreground)"
      >
        {selectedCode ?? 'Camelot'}
      </text>
    </svg>
  );
}
