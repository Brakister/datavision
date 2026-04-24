import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip as UITooltip } from '@/components/ui/tooltip';
import { cn } from '@/utils/cn';
import { motion } from 'framer-motion';
import {
  Maximize2,
  Minimize2,
  Download,
  Info,
  Filter,
  X,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import type { ChartType } from '@/types';

export interface ChartWrapperProps {
  title: string;
  subtitle?: string;
  description?: string;
  dataSource?: string;
  metrics?: string[];
  dimensions?: string[];
  chartType: ChartType;
  isLoading?: boolean;
  isEmpty?: boolean;
  children: React.ReactNode;
  exportFileName?: string;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onExport?: (pngDataUrl: string) => void;
  onFilter?: () => void;
  onRemove?: () => void;
  filtersApplied?: string[];
  className?: string;
}

export function ChartWrapper({
  title,
  subtitle,
  description,
  dataSource,
  metrics,
  dimensions,
  chartType,
  isLoading,
  isEmpty,
  children,
  exportFileName,
  onFullscreenChange,
  onExport,
  onFilter,
  onRemove,
  filtersApplied,
  className,
}: ChartWrapperProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const handleToggleFullscreen = React.useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      onFullscreenChange?.(next);
      return next;
    });
  }, [onFullscreenChange]);

  const handleExport = React.useCallback(async () => {
    if (!contentRef.current) return;
    const fileSafeTitle = (exportFileName || title || 'chart')
      .trim()
      .replace(/[^\w\-]+/g, '_')
      .slice(0, 80);

    const dataUrl = await toPng(contentRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: 'transparent',
    });

    onExport?.(dataUrl);

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${fileSafeTitle}.png`;
    link.click();
  }, [exportFileName, onExport, title]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
          <Info className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-sm font-medium">Sem dados para exibir</p>
          <p className="text-xs mt-1">Ajuste os filtros ou selecione outras colunas</p>
        </CardContent>
      </Card>
    );
  }

  const content = (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              <Badge variant="secondary" className="text-[10px]">{chartType}</Badge>
            </div>
            {subtitle && <CardDescription className="text-xs mt-0.5">{subtitle}</CardDescription>}
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {filtersApplied && filtersApplied.length > 0 && (
              <UITooltip content={`${filtersApplied.length} filtro(s) ativo(s)`}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Filter className="h-4 w-4 text-primary" />
                </Button>
              </UITooltip>
            )}
            {onFilter && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFilter}>
                <Filter className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleToggleFullscreen}
              aria-label={isFullscreen ? 'Sair do fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleExport}
              aria-label="Exportar PNG"
            >
                <Download className="h-4 w-4" />
            </Button>
            {onRemove && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {(metrics || dimensions || dataSource) && (
          <div className="flex flex-wrap gap-2 mt-2">
            {dimensions?.map((d) => (
              <Badge key={d} variant="outline" className="text-[10px]">Dim: {d}</Badge>
            ))}
            {metrics?.map((m) => (
              <Badge key={m} variant="outline" className="text-[10px]">Metric: {m}</Badge>
            ))}
            {dataSource && (
              <Badge variant="outline" className="text-[10px]">Fonte: {dataSource}</Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className={isFullscreen ? 'h-[calc(100vh-180px)]' : ''}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full"
          ref={contentRef}
        >
          {children}
        </motion.div>
      </CardContent>
    </Card>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="absolute inset-4">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
