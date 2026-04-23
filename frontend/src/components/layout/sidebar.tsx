import { useAppStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Upload,
  LayoutDashboard,
  Table2,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const navItems = [
  { icon: Upload, label: 'Upload', path: '/' },
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Table2, label: 'Tabela', path: '/table' },
  { icon: BarChart3, label: 'Graficos', path: '/charts' },
  { icon: Filter, label: 'Filtros', path: '/filters' },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, currentFile } = useAppStore();
  const location = useLocation();

  return (
    <motion.aside
      className="fixed left-0 top-0 z-50 h-screen border-r bg-card flex flex-col"
      animate={{ width: sidebarCollapsed ? 64 : 256 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <div className="flex h-14 items-center justify-between px-4 border-b">
        {!sidebarCollapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-bold text-sm tracking-wider text-muted-foreground uppercase"
          >
            Navegacao
          </motion.span>
        )}
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="ml-auto">
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            const content = (
              <Link
                to={item.path}
                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }
                  ${sidebarCollapsed ? 'justify-center' : ''}
                `}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );

            return sidebarCollapsed ? (
              <Tooltip key={item.path} content={item.label} side="right">
                {content}
              </Tooltip>
            ) : (
              <div key={item.path}>{content}</div>
            );
          })}
        </nav>

        {currentFile && !sidebarCollapsed && (
          <>
            <Separator className="my-4 mx-4 w-auto" />
            <div className="px-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Abas do Arquivo
              </h4>
              <div className="space-y-1">
                {currentFile.sheets.map((sheet) => (
                  <button
                    key={sheet.name}
                    className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span className="truncate">{sheet.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {sheet.row_count.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </ScrollArea>

      <div className="border-t p-4">
        <Tooltip content="Configuracoes" side="right">
          <Button variant="ghost" size="icon" className="w-full">
            <Settings className="h-5 w-5" />
          </Button>
        </Tooltip>
      </div>
    </motion.aside>
  );
}
