import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';
import React from 'react';

/**
 * The headline-number tile used across the library detail screen: a small tinted
 * icon square, an uppercase label, and a large tabular figure. `accent` picks a
 * slot from the chart ramp (1-5) so a row of tiles stays on-palette without any
 * hardcoded colors.
 */
export interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  accent?: 1 | 2 | 3 | 4 | 5;
  trend?: { value: number; isPositive: boolean };
  className?: string;
}

const accentTile: Record<NonNullable<StatTileProps['accent']>, string> = {
  1: 'bg-chart-1/15 text-chart-1',
  2: 'bg-chart-2/15 text-chart-2',
  3: 'bg-chart-3/15 text-chart-3',
  4: 'bg-chart-4/15 text-chart-4',
  5: 'bg-chart-5/15 text-chart-5',
};

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  hint,
  icon,
  accent = 1,
  trend,
  className,
}) => {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4',
              accentTile[accent],
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {label}
            </p>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
          </div>
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              trend.isPositive ? 'text-primary' : 'text-destructive',
            )}
          >
            <TrendingUp className={cn('h-3.5 w-3.5', !trend.isPositive && 'rotate-180')} />
            <span className="tabular-nums">{Math.abs(trend.value)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
