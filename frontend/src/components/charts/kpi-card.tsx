import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  previousValue?: number;
  format?: 'number' | 'currency' | 'percentage' | 'decimal';
  prefix?: string;
  suffix?: string;
  isLoading?: boolean;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  previousValue,
  format = 'number',
  prefix = '',
  suffix = '',
  isLoading,
  className,
}: KPICardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  const formattedValue = React.useMemo(() => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return String(value);

    switch (format) {
      case 'currency':
        return `${prefix}${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
      case 'percentage':
        return `${prefix}${num.toFixed(1)}%${suffix}`;
      case 'decimal':
        return `${prefix}${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
      default:
        return `${prefix}${num.toLocaleString('pt-BR')}${suffix}`;
    }
  }, [value, format, prefix, suffix]);

  const variation = React.useMemo(() => {
    if (previousValue === undefined || typeof value !== 'number') return null;
    const current = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(current) || previousValue === 0) return null;
    const change = ((current - previousValue) / Math.abs(previousValue)) * 100;
    return change;
  }, [value, previousValue]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-3xl font-bold tracking-tight">{formattedValue}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {variation !== null && (
            <div className="flex items-center gap-1 mt-2">
              {variation > 0 ? (
                <>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  <Badge variant="success" className="text-[10px]">+{variation.toFixed(1)}%</Badge>
                </>
              ) : variation < 0 ? (
                <>
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  <Badge variant="destructive" className="text-[10px]">{variation.toFixed(1)}%</Badge>
                </>
              ) : (
                <>
                  <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge variant="secondary" className="text-[10px]">0%</Badge>
                </>
              )}
              <span className="text-[10px] text-muted-foreground ml-1">vs anterior</span>
            </div>
          )}
        </motion.div>
      </CardContent>
    </Card>
  );
}
