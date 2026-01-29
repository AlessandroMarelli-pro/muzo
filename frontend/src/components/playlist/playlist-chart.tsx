'use client';

import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatTime } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';

export interface PlaylistChartData {
  key?: string;
  tempo?: number;
  name?: string;
  duration: number;
}

export const description = 'A multiple line chart';

const chartConfig = {
  tempo: {
    label: 'Tempo',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

export function PlaylistChart({
  data,
  isLoading,
}: {
  data: PlaylistChartData[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-[30vh] aspect-auto" />;
  }
  const minTempo = Math.min(...data.map((item) => item.tempo || 0)) - 1;
  const dataWithTempoAdjusted = data.map((item, index) => {
    const cumulatedDuration = data
      .slice(0, index)
      .reduce((acc, curr) => acc + curr.duration, 0);
    return {
      ...item,
      tempo: item.tempo ? ((item.tempo - minTempo) / 10).toFixed(2) : 0,
      duration: formatTime(cumulatedDuration),
    };
  });
  return (
    <ChartContainer config={chartConfig} className="h-[30vh] aspect-auto">
      <AreaChart
        accessibilityLayer
        data={dataWithTempoAdjusted}
        margin={{
          left: 12,
          right: 12,
        }}
      >
        <defs>
          <linearGradient id="fillTempo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-5)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--chart-5)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillDanceability" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillEnergy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillValence" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={true} />
        <XAxis
          dataKey="duration"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <Area
          dataKey="tempo"
          type="natural"
          stroke="var(--chart-3)"
          fill="url(#fillTempo)"
          stackId="a"
        />

        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              className="w-[200px]"
              formatter={(value, name, item, index) => (
                <>
                  {index === 0 && (
                    <div className="text-foreground mb-1.5 flex basis-full items-center border-b pb-1.5 text-xs font-medium capitalize">
                      {item.payload.name}
                      <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums"></div>
                    </div>
                  )}
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-(--color-bg)"
                    style={
                      {
                        '--color-bg': `var(--color-${name})`,
                      } as React.CSSProperties
                    }
                  />
                  {chartConfig[name as keyof typeof chartConfig]?.label || name}
                  <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
                    {name === 'tempo' ? Number(value) * 10 + minTempo : value}
                  </div>
                  {/* Add this after the last item */}
                </>
              )}
              cursor={false}
              defaultIndex={1}
              indicator="dot"
            />
          }
        />
      </AreaChart>
    </ChartContainer>
  );
}
