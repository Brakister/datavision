import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores';
import { uploadService } from '@/services';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { motion, AnimatePresence } from 'framer-motion';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const uploadSession = useAppStore((s) => s.uploadSession);
  const updateUploadSession = useAppStore((s) => s.updateUploadSession);
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  const uploadStatusQuery = useQuery({
    queryKey: ['upload-status', uploadSession?.fileUuid],
    queryFn: () => uploadService.getStatus(uploadSession!.fileUuid!),
    enabled:
      !!uploadSession?.fileUuid &&
      uploadSession.status !== 'completed' &&
      uploadSession.status !== 'inconsistent' &&
      uploadSession.status !== 'failed',
    refetchInterval:
      uploadSession?.fileUuid &&
      uploadSession.status !== 'completed' &&
      uploadSession.status !== 'inconsistent' &&
      uploadSession.status !== 'failed'
        ? 1500
        : false,
    retry: 0,
  });

  useEffect(() => {
    if (!uploadStatusQuery.data) return;

    updateUploadSession({
      status: uploadStatusQuery.data.status,
      stage: uploadStatusQuery.data.stage,
      progress: uploadStatusQuery.data.progress,
      message: uploadStatusQuery.data.message,
      updatedAt: new Date().toISOString(),
    });
  }, [uploadStatusQuery.data, updateUploadSession]);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main
          className="flex-1 overflow-auto p-4 md:p-6"
          style={{
            marginLeft: isDesktop ? (sidebarCollapsed ? '4rem' : '16rem') : '0rem',
            transition: 'margin-left 0.3s ease',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
