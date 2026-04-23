import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services';
import type { FilterOperator } from '@/types';

export function useTableData(
  fileUuid: string | null,
  sheetName: string | null,
  page: number = 1,
  pageSize: number = 100,
  filters: FilterOperator[] = []
) {
  return useQuery({
    queryKey: ['table-data', fileUuid, sheetName, page, pageSize, filters],
    queryFn: () =>
      analyticsService.getTableData({
        file_uuid: fileUuid!,
        sheet_name: sheetName!,
        page,
        page_size: pageSize,
        filters,
      }),
    enabled: !!fileUuid && !!sheetName,
    staleTime: 1000 * 60 * 2,
  });
}
