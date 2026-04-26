import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services';

export function useChartSuggestions(fileUuid: string | null, sheetName: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['chart-suggestions', fileUuid, sheetName],
    queryFn: () => analyticsService.getSuggestions(fileUuid!, sheetName!),
    enabled: !!fileUuid && !!sheetName && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
