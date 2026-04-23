import { useQuery } from '@tanstack/react-query';
import { fileService } from '@/services';

export function useFileMetadata(fileUuid: string | null) {
  return useQuery({
    queryKey: ['file-metadata', fileUuid],
    queryFn: () => fileService.getMetadata(fileUuid!),
    enabled: !!fileUuid,
    staleTime: 1000 * 60 * 5,
  });
}
