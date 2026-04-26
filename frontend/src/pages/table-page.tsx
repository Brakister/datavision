import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Table2, ArrowLeft, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { useFileMetadata } from '@/hooks/use-file-metadata';
import { useTableData } from '@/hooks/use-table-data';
import { useFileNavigation } from '@/hooks/use-file-navigation';
import { useAppStore } from '@/stores';
import { FilterPanel } from '@/components/filters/filter-panel';

export function TablePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileUuid = searchParams.get('file');
  const { buildPath } = useFileNavigation();

  const { selectedSheet, setSelectedSheet, setCurrentFile, activeFilters } = useAppStore();

  const metadataQuery = useFileMetadata(fileUuid);

  React.useEffect(() => {
    if (metadataQuery.data) {
      setCurrentFile(metadataQuery.data);
      if (!selectedSheet) {
        setSelectedSheet(metadataQuery.data.sheets[0]?.name ?? null);
      }
    }
  }, [metadataQuery.data, selectedSheet, setCurrentFile, setSelectedSheet]);

  const tableQuery = useTableData(fileUuid, selectedSheet, 1, 100, activeFilters);

  const activeSheetMeta = React.useMemo(() => {
    if (!metadataQuery.data || !selectedSheet) return null;
    return metadataQuery.data.sheets.find((sheet) => sheet.name === selectedSheet) ?? null;
  }, [metadataQuery.data, selectedSheet]);

  const sheetOptions = React.useMemo(() => {
    const sheets = metadataQuery.data?.sheets ?? [];
    return sheets.map((s) => ({ value: s.name, label: `${s.name} (${s.row_count.toLocaleString()} linhas)` }));
  }, [metadataQuery.data]);

  if (!fileUuid) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Table2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold">Nenhum arquivo selecionado</h2>
            <p className="text-sm text-muted-foreground mt-2">Abra o dashboard a partir de um upload.</p>
            <Button className="mt-6" onClick={() => navigate('/upload')}>
              <ArrowLeft className="h-4 w-4" />
              Ir para Upload
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight truncate">Dados brutos</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Visualização paginada (server-side) com dados reais do DuckDB.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {metadataQuery.isLoading ? (
            <Skeleton className="h-10 w-[260px]" />
          ) : (
            <div className="w-[320px] max-w-[80vw]">
              <Select
                value={selectedSheet ?? ''}
                onChange={(e) => setSelectedSheet(e.target.value)}
                options={sheetOptions}
              />
            </div>
          )}
          <Button variant="outline" onClick={() => navigate(buildPath('/dashboard'))}>
            <ArrowLeft className="h-4 w-4" />
            Voltar ao dashboard
          </Button>
        </div>
      </div>

      {activeSheetMeta && (
        <FilterPanel columns={activeSheetMeta.columns} affectedRows={tableQuery.data?.total_rows} />
      )}

      {metadataQuery.isError ? (
        <Card>
          <CardContent className="p-4 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <div>
              <div className="font-medium">Falha ao carregar metadados</div>
              <div className="text-muted-foreground">
                {String((metadataQuery.error as any)?.response?.data?.detail || (metadataQuery.error as Error)?.message || '')}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tabela</CardTitle>
            <CardDescription>
              Mostrando as primeiras 100 linhas da aba selecionada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tableQuery.isLoading ? (
              <Skeleton className="h-[340px] w-full" />
            ) : tableQuery.isError ? (
              <div className="text-sm text-muted-foreground flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  Falha ao carregar dados da tabela.
                </div>
              </div>
            ) : (
              <div className="w-full overflow-auto rounded-lg border">
                <table className="min-w-[800px] w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      {Object.keys(tableQuery.data?.data?.[0] ?? {}).map((key) => (
                        <th key={key} className="text-left font-medium px-3 py-2 border-b">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(tableQuery.data?.data ?? []).map((row: any, idx: number) => (
                      <tr key={idx} className="odd:bg-background even:bg-muted/10">
                        {Object.keys(row).map((key) => (
                          <td key={key} className="px-3 py-2 border-b text-muted-foreground">
                            {row[key] === null || row[key] === undefined ? '' : String(row[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
