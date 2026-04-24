import * as React from 'react';
import {
  RadarChart as ReRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartWrapper } from './chart-wrapper';
import type { ChartWrapperProps } from './chart-wrapper';

interface RadarChartProps extends Omit<ChartWrapperProps, 'children' | 'chartType'> {
  data: Array<Record<string, unknown>>;
  angleKey: string;
  valueKeys: string[];
  colors?: string[];
}

const DEFAULT_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

export function RadarChart({
  data,
  angleKey,
  valueKeys,
  colors = DEFAULT_COLORS,
  ...wrapperProps
}: RadarChartProps) {
  const [activeSeries, setActiveSeries] = React.useState<Set<string>>(new Set(valueKeys));

  const toggleSeries = (series: string) => {
    setActiveSeries((prev) => {
      const next = new Set(prev);
      if (next.has(series)) next.delete(series);
      else next.add(series);
      return next;
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="rounded-lg border bg-popover p-3 shadow-lg">
        <p className="text-sm font-semibold mb-2">{label}</p>
        {payload.map((entry: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : String(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ChartWrapper chartType="radar" {...wrapperProps}>
      <ResponsiveContainer width="100%" height={350}>
        <ReRadarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey={angleKey}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <PolarRadiusAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend onClick={(e: any) => toggleSeries(e.value)} wrapperStyle={{ fontSize: 12 }} />
          {valueKeys.map((key, idx) => (
            <Radar
              key={key}
              name={key}
              dataKey={key}
              stroke={colors[idx % colors.length]}
              fill={colors[idx % colors.length]}
              fillOpacity={activeSeries.has(key) ? 0.25 : 0.05}
              strokeOpacity={activeSeries.has(key) ? 1 : 0.2}
              animationDuration={800}
            />
          ))}
        </ReRadarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

