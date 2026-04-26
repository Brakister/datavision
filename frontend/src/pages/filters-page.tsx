import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Filter, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores';
import { useFileNavigation } from '@/hooks/use-file-navigation';
import { useFileMetadata } from '@/hooks/use-file-metadata';
import { useTableData } from '@/hooks/use-table-data';
import { FilterPanel } from '@/components/filters/filter-panel';

export function FiltersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileUuid = searchParams.get('file');
  const { buildPath } = useFileNavigation();
  const { selectedSheet, setSelectedSheet, activeFilters } = useAppStore();

  const metadataQuery = useFileMetadata(fileUuid);

  React.useEffect(() => {
    if (!metadataQuery.data) return;
    if (!selectedSheet) {
      setSelectedSheet(metadataQuery.data.sheets[0]?.name ?? null);
    }
  }, [metadataQuery.data, selectedSheet, setSelectedSheet]);

  const sheetMeta = React.useMemo(() => {
    if (!metadataQuery.data || !selectedSheet) return null;
    return metadataQuery.data.sheets.find((sheet) => sheet.name === selectedSheet) ?? null;
  }, [metadataQuery.data, selectedSheet]);

  const previewQuery = useTableData(fileUuid, selectedSheet, 1, 1, activeFilters, !!fileUuid && !!selectedSheet);

  if (!fileUuid) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Filter className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold">Nenhum arquivo selecionado</h2>
            <p className="text-sm text-muted-foreground mt-2">Abra esta pagina a partir de um arquivo carregado.</p>
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
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Filtros cross-dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Os filtros abaixo sao aplicados ao dashboard e a tabela em conjunto.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(buildPath('/dashboard'))}>
          <ArrowLeft className="h-4 w-4" />
          Voltar ao dashboard
        </Button>
      </div>

      {metadataQuery.isLoading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : sheetMeta ? (
        <FilterPanel columns={sheetMeta.columns} affectedRows={previewQuery.data?.total_rows} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma aba selecionada</CardTitle>
            <CardDescription>Selecione uma aba no dashboard para configurar filtros.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resumo da aplicacao</CardTitle>
          <CardDescription>
            Total de filtros ativos: {activeFilters.length}.
            {previewQuery.data?.total_rows !== undefined
              ? ` Linhas impactadas: ${previewQuery.data.total_rows.toLocaleString()}.`
              : ''}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
