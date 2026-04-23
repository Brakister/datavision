import * as React from 'react';
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ChartWrapper } from './chart-wrapper';
import type { ChartWrapperProps } from './chart-wrapper';

interface BarChartProps extends Omit<ChartWrapperProps, 'children' | 'chartType'> {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKeys: string[];
  colors?: string[];
  stacked?: boolean;
  horizontal?: boolean;
  onBarClick?: (data: Record<string, unknown>) => void;
}

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
];

export function BarChart({
  data,
  xKey,
  yKeys,
  colors = DEFAULT_COLORS,
  stacked = false,
  horizontal = false,
  onBarClick,
  ...wrapperProps
}: BarChartProps) {
  const [activeSeries, setActiveSeries] = React.useState<Set<string>>(new Set(yKeys));

  const toggleSeries = (series: string) => {
    setActiveSeries((prev) => {
      const next = new Set(prev);
      if (next.has(series)) {
        next.delete(series);
      } else {
        next.add(series);
      }
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
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ChartWrapper chartType="bar" {...wrapperProps}>
      <ResponsiveContainer width="100%" height={350}>
        <ReBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey={horizontal ? undefined : xKey}
            type={horizontal ? 'number' : 'category'}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            dataKey={horizontal ? xKey : undefined}
            type={horizontal ? 'category' : 'number'}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            onClick={(e: any) => toggleSeries(e.value)}
            wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
          />
          {yKeys.map((key, idx) => (
            <Bar
              key={key}
              dataKey={key}
              fill={colors[idx % colors.length]}
              stackId={stacked ? 'stack' : undefined}
              opacity={activeSeries.has(key) ? 1 : 0.2}
              onClick={(_, index) => onBarClick?.(data[index])}
              radius={[4, 4, 0, 0]}
              animationDuration={800}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[idx % colors.length]} />
              ))}
            </Bar>
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
