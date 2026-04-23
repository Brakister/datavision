import * as React from 'react';
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartWrapper } from './chart-wrapper';
import type { ChartWrapperProps } from './chart-wrapper';

interface PieChartProps extends Omit<ChartWrapperProps, 'children' | 'chartType'> {
  data: Array<Record<string, unknown>>;
  nameKey: string;
  valueKey: string;
  colors?: string[];
  donut?: boolean;
  onSliceClick?: (data: Record<string, unknown>) => void;
}

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
  '#14b8a6', '#d946ef', '#f43f5e', '#8b5cf6', '#0ea5e9',
];

export function PieChart({
  data,
  nameKey,
  valueKey,
  colors = DEFAULT_COLORS,
  donut = false,
  onSliceClick,
  ...wrapperProps
}: PieChartProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const entry = payload[0];
    const total = data.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);
    const percentage = total > 0 ? ((Number(entry.value) / total) * 100).toFixed(1) : '0';

    return (
      <div className="rounded-lg border bg-popover p-3 shadow-lg">
        <p className="text-sm font-semibold">{entry.name}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Valor: {Number(entry.value).toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">
          Percentual: {percentage}%
        </p>
      </div>
    );
  };

  return (
    <ChartWrapper chartType={donut ? 'donut' : 'pie'} {...wrapperProps}>
      <ResponsiveContainer width="100%" height={350}>
        <RePieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={donut ? 80 : 0}
            outerRadius={120}
            paddingAngle={2}
            dataKey={valueKey}
            nameKey={nameKey}
            onClick={(_, index) => {
              setActiveIndex(index);
              onSliceClick?.(data[index]);
            }}
            animationDuration={800}
            animationBegin={0}
          >
            {data.map((_, index) => (
              <Cell
                key={index}
                fill={colors[index % colors.length]}
                stroke="hsl(var(--background))"
                strokeWidth={2}
                opacity={activeIndex === null || activeIndex === index ? 1 : 0.6}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) => (
              <span className="text-muted-foreground">{value}</span>
            )}
          />
        </RePieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
