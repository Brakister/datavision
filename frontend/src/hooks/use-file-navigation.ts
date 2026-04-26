import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/stores';

function appendFileParam(path: string, fileUuid: string): string {
  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  params.set('file', fileUuid);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function useFileNavigation() {
  const location = useLocation();
  const currentFileUuid = useAppStore((state) => state.currentFile?.uuid ?? null);
  const uploadSessionFileUuid = useAppStore((state) => state.uploadSession?.fileUuid ?? null);

  const activeFileUuid = useMemo(() => {
    const fromQuery = new URLSearchParams(location.search).get('file');
    return fromQuery ?? currentFileUuid ?? uploadSessionFileUuid ?? null;
  }, [location.search, currentFileUuid, uploadSessionFileUuid]);

  const buildPath = useMemo(
    () =>
      (path: string, preserveFile = true) => {
        if (!preserveFile || !activeFileUuid || path === '/' || path === '/upload') {
          return path;
        }

        return appendFileParam(path, activeFileUuid);
      },
    [activeFileUuid]
  );

  return { activeFileUuid, buildPath };
}
