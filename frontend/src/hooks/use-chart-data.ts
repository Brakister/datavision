import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services';
import type { ChartSuggestion } from '@/types';

export function useChartData(
  fileUuid: string | null,
  sheetName: string | null,
  suggestion: ChartSuggestion | null,
  filters?: Record<string, unknown>,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['chart-data', fileUuid, sheetName, suggestion, filters],
    queryFn: () =>
      analyticsService.getChartData({
        file_uuid: fileUuid!,
        sheet_name: sheetName!,
        chart_type: suggestion!.chart_type,
        dimension_columns: suggestion!.dimension_columns,
        metric_columns: suggestion!.metric_columns,
        aggregation: suggestion!.recommended_aggregation,
        filters: filters || {},
        limit: 1000,
      }),
    enabled: !!fileUuid && !!sheetName && !!suggestion && enabled,
    staleTime: 1000 * 60 * 2,
  });
}
