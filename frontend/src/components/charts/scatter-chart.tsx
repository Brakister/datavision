import * as React from 'react';
import {
  ScatterChart as ReScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';
import { ChartWrapper } from './chart-wrapper';
import type { ChartWrapperProps } from './chart-wrapper';
import { formatMetricValue } from './value-format';

interface ScatterChartProps extends Omit<ChartWrapperProps, 'children' | 'chartType'> {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  zKey?: string;
  nameKey?: string;
  color?: string;
  onPointClick?: (data: Record<string, unknown>) => void;
}

export function ScatterChart({
  data,
  xKey,
  yKey,
  zKey,
  nameKey,
  color = '#3b82f6',
  onPointClick,
  ...wrapperProps
}: ScatterChartProps) {
  const [visible, setVisible] = React.useState(true);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const point = payload[0].payload;
    return (
      <div className="rounded-lg border bg-popover p-3 shadow-lg">
        {nameKey && <p className="text-sm font-semibold">{point[nameKey]}</p>}
        <p className="text-xs text-muted-foreground mt-1">
          {xKey}: {formatMetricValue(point[xKey], xKey)}
        </p>
        <p className="text-xs text-muted-foreground">
          {yKey}: {formatMetricValue(point[yKey], yKey)}
        </p>
        {zKey && (
          <p className="text-xs text-muted-foreground">
            {zKey}: {formatMetricValue(point[zKey], zKey)}
          </p>
        )}
      </div>
    );
  };

  return (
    <ChartWrapper chartType="scatter" {...wrapperProps}>
      <ResponsiveContainer width="100%" height={350}>
        <ReScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            type="number"
            dataKey={xKey}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            name={xKey}
          />
          <YAxis
            type="number"
            dataKey={yKey}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            name={yKey}
          />
          {zKey && <ZAxis type="number" dataKey={zKey} range={[50, 400]} />}
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Legend
            wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
            onClick={() => setVisible((prev) => !prev)}
          />
          {visible && (
            <Scatter
              name={`${xKey} vs ${yKey}`}
              data={data}
              fill={color}
              onClick={(point: any) => onPointClick?.(point.payload)}
              animationDuration={800}
            />
          )}
        </ReScatterChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
