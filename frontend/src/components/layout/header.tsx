import { useAppStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Moon,
  Sun,
  Bell,
  Menu,
  FileSpreadsheet,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { InconsistencyDetails } from './inconsistency-details';

export function Header() {
  const { theme, toggleTheme, toggleSidebar, currentFile, activeFilters } = useAppStore();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center px-4 gap-4">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="shrink-0">
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
          </div>
          <span className="font-bold text-lg tracking-tight hidden sm:inline">DataVision</span>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {currentFile ? (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <div className="truncate">
              <span className="text-sm font-medium truncate">{currentFile.original_filename}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {currentFile.total_rows.toLocaleString()} linhas · {currentFile.total_sheets} aba(s)
              </span>
            </div>
            {currentFile.status === 'inconsistent' ? (
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="warning" className="shrink-0">
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  Inconsistente
                </Badge>
                <InconsistencyDetails report={currentFile.integrity_report} compact />
              </div>
            ) : (
              <Badge variant="success" className="shrink-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                OK
              </Badge>
            )}
          </motion.div>
        ) : (
          <div className="text-sm text-muted-foreground">Nenhum arquivo carregado</div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {activeFilters.length > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {activeFilters.length} filtro(s)
            </Badge>
          )}

          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
