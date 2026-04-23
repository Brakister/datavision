import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Download,
  Search,
} from 'lucide-react';
import type { ColumnSchema, TableData } from '@/types';

interface DataTableProps {
  data: TableData;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onColumnToggle?: (column: string) => void;
  onSearch?: (query: string) => void;
  onExport?: () => void;
  className?: string;
}

export function DataTable({
  data,
  isLoading,
  onPageChange,
  onSort,
  onColumnToggle,
  onSearch,
  onExport,
  className,
}: DataTableProps) {
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [hiddenColumns, setHiddenColumns] = React.useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showColumnMenu, setShowColumnMenu] = React.useState(false);
  const parentRef = React.useRef<HTMLDivElement>(null);

  const visibleColumns = data.columns.filter((c) => !hiddenColumns.has(c.name));

  const handleSort = (column: string) => {
    let newDirection: 'asc' | 'desc' = 'asc';
    if (sortColumn === column) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    }
    setSortColumn(column);
    setSortDirection(newDirection);
    onSort?.(column, newDirection);
  };

  const toggleColumn = (column: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
    onColumnToggle?.(column);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary" />
    );
  };

  const formatCellValue = (value: unknown, column: ColumnSchema) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground italic">null</span>;
    if (value === '') return <span className="text-muted-foreground italic">vazio</span>;

    switch (column.detected_type) {
      case 'currency':
        return typeof value === 'number'
          ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : String(value);
      case 'percentage':
        return typeof value === 'number' ? `${value.toFixed(1)}%` : String(value);
      case 'date':
      case 'datetime':
        try {
          return new Date(String(value)).toLocaleDateString('pt-BR');
        } catch {
          return String(value);
        }
      case 'integer':
      case 'float':
      case 'decimal':
        return typeof value === 'number' ? value.toLocaleString('pt-BR') : String(value);
      default:
        return String(value);
    }
  };

  const getCellColor = (value: unknown, column: ColumnSchema) => {
    if (value === null || value === undefined) return 'text-muted-foreground';
    if (column.detected_type === 'currency' || column.detected_type === 'percentage') return 'font-mono text-right';
    if (column.detected_type === 'integer' || column.detected_type === 'float' || column.detected_type === 'decimal') return 'font-mono text-right';
    return '';
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Dados</CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {data.total_rows.toLocaleString()} linhas
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs w-48"
              />
            </form>
            <div className="relative">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowColumnMenu(!showColumnMenu)}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                Colunas
              </Button>
              {showColumnMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border bg-popover p-2 shadow-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Visibilidade</p>
                  {data.columns.map((col) => (
                    <button
                      key={col.name}
                      className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                      onClick={() => toggleColumn(col.name)}
                    >
                      {hiddenColumns.has(col.name) ? (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-primary" />
                      )}
                      <span className={hiddenColumns.has(col.name) ? 'text-muted-foreground' : ''}>{col.name}</span>
                      <Badge variant="outline" className="ml-auto text-[9px]">{col.detected_type}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {onExport && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onExport}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Exportar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div ref={parentRef} className="overflow-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card border-b">
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.name}
                    className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer hover:bg-accent/50 transition-colors select-none whitespace-nowrap"
                    onClick={() => handleSort(column.name)}
                  >
                    <div className="flex items-center gap-1">
                      {column.name}
                      {getSortIcon(column.name)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.map((row, rowIndex) => (
                <motion.tr
                  key={rowIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: rowIndex * 0.01 }}
                  className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                >
                  {visibleColumns.map((column) => (
                    <td
                      key={column.name}
                      className={`px-4 py-2.5 whitespace-nowrap ${getCellColor(row[column.name], column)}`}
                    >
                      {formatCellValue(row[column.name], column)}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginacao */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-xs text-muted-foreground">
            Pagina {data.page} de {data.total_pages} · {data.total_rows.toLocaleString()} total
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={data.page <= 1}
              onClick={() => onPageChange?.(1)}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={data.page <= 1}
              onClick={() => onPageChange?.(data.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs px-2 min-w-[3rem] text-center">
              {data.page}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={data.page >= data.total_pages}
              onClick={() => onPageChange?.(data.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={data.page >= data.total_pages}
              onClick={() => onPageChange?.(data.total_pages)}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
