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
import { formatMetricValue } from './value-format';

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
  const [hiddenNames, setHiddenNames] = React.useState<Set<string>>(new Set());

  const visibleData = React.useMemo(
    () => data.filter((item) => !hiddenNames.has(String(item[nameKey]))),
    [data, hiddenNames, nameKey]
  );

  const toggleSlice = React.useCallback((sliceName: string) => {
    setHiddenNames((prev) => {
      const next = new Set(prev);
      if (next.has(sliceName)) next.delete(sliceName);
      else next.add(sliceName);
      return next;
    });
  }, []);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const entry = payload[0];
    const total = visibleData.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);
    const percentage = total > 0 ? ((Number(entry.value) / total) * 100).toFixed(1) : '0';

    return (
      <div className="rounded-lg border bg-popover p-3 shadow-lg">
        <p className="text-sm font-semibold">{entry.name}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Valor: {formatMetricValue(entry.value, valueKey)}
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
            data={visibleData}
            cx="50%"
            cy="50%"
            innerRadius={donut ? 80 : 0}
            outerRadius={120}
            paddingAngle={2}
            dataKey={valueKey}
            nameKey={nameKey}
            onClick={(_, index) => {
              setActiveIndex(index);
              onSliceClick?.(visibleData[index]);
            }}
            animationDuration={800}
            animationBegin={0}
          >
            {visibleData.map((_, index) => (
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
            onClick={(entry: any) => toggleSlice(String(entry.value))}
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) => (
              <span className={hiddenNames.has(value) ? 'text-muted-foreground line-through opacity-60' : 'text-muted-foreground'}>{value}</span>
            )}
          />
        </RePieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
