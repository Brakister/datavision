import * as React from 'react';
import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { ChartWrapper } from './chart-wrapper';
import type { ChartWrapperProps } from './chart-wrapper';
import { formatMetricValue } from './value-format';

interface LineChartProps extends Omit<ChartWrapperProps, 'children' | 'chartType'> {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKeys: string[];
  colors?: string[];
  showArea?: boolean;
  onPointClick?: (data: Record<string, unknown>) => void;
}

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
];

export function LineChart({
  data,
  xKey,
  yKeys,
  colors = DEFAULT_COLORS,
  showArea = false,
  onPointClick,
  ...wrapperProps
}: LineChartProps) {
  const [activeSeries, setActiveSeries] = React.useState<Set<string>>(new Set(yKeys));

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
            <span className="font-medium">{formatMetricValue(entry.value, String(entry.name ?? 'valor'))}</span>
          </div>
        ))}
      </div>
    );
  };

  const ChartComponent = showArea ? AreaChart : ReLineChart;

  return (
    <ChartWrapper chartType={showArea ? 'area' : 'line'} {...wrapperProps}>
      <ResponsiveContainer width="100%" height={350}>
        <ChartComponent
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            onClick={(e: any) => toggleSeries(e.value)}
            wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
          />
          {yKeys.map((key, idx) => {
            const color = colors[idx % colors.length];
            if (showArea) {
              return (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  fill={color}
                  fillOpacity={activeSeries.has(key) ? 0.2 : 0.05}
                  strokeOpacity={activeSeries.has(key) ? 1 : 0.2}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  animationDuration={800}
                />
              );
            }
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                strokeOpacity={activeSeries.has(key) ? 1 : 0.2}
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={800}
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
