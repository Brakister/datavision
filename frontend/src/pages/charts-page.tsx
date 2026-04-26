import * as React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BarChart3, FileSpreadsheet, ArrowLeft, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { useFileMetadata } from '@/hooks/use-file-metadata';
import { useChartSuggestions } from '@/hooks/use-chart-suggestions';
import { useChartData } from '@/hooks/use-chart-data';
import { useFileNavigation } from '@/hooks/use-file-navigation';
import { useAppStore } from '@/stores';
import { InconsistencyDetails } from '@/components/layout/inconsistency-details';
import { FilterPanel } from '@/components/filters/filter-panel';
import { formatFilterLabel, mapFiltersToChartRequest } from '@/utils/filter-mappers';

import type { ChartSuggestion } from '@/types';
import { BarChart, LineChart, PieChart, ScatterChart, RadarChart, ChartWrapper, KPICard } from '@/components/charts';

export function ChartsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileUuid = searchParams.get('file');
  const { buildPath } = useFileNavigation();

  const {
    currentFile,
    setCurrentFile,
    selectedSheet,
    setSelectedSheet,
    chartSuggestions,
    setChartSuggestions,
    uploadSession,
    activeFilters,
  } = useAppStore();

  const activeFile = currentFile?.uuid === fileUuid ? currentFile : null;
  const activeSheet = activeFile ? selectedSheet : null;
  const isProcessingUpload = uploadSession?.fileUuid === fileUuid && uploadSession.status === 'processing';

  const metadataQuery = useFileMetadata(fileUuid, !isProcessingUpload);

  React.useEffect(() => {
    if (metadataQuery.data) {
      setCurrentFile(metadataQuery.data);
      if (currentFile?.uuid !== metadataQuery.data.uuid || !selectedSheet) {
        setSelectedSheet(metadataQuery.data.sheets[0]?.name ?? null);
      }
    }
  }, [currentFile?.uuid, metadataQuery.data, selectedSheet, setCurrentFile, setSelectedSheet]);

  const suggestionsQuery = useChartSuggestions(fileUuid, activeSheet, !isProcessingUpload && !!activeSheet);

  React.useEffect(() => {
    if (suggestionsQuery.data) {
      setChartSuggestions(suggestionsQuery.data);
    }
  }, [suggestionsQuery.data, setChartSuggestions]);

  const [activeSuggestion, setActiveSuggestion] = React.useState<ChartSuggestion | null>(null);

  React.useEffect(() => {
    if (!activeSuggestion && chartSuggestions.length > 0) {
      setActiveSuggestion(chartSuggestions[0]);
    }
  }, [activeSuggestion, chartSuggestions]);

  const chartFilters = React.useMemo(() => mapFiltersToChartRequest(activeFilters), [activeFilters]);
  const filterLabels = React.useMemo(() => activeFilters.map(formatFilterLabel), [activeFilters]);

  const chartDataQuery = useChartData(
    fileUuid,
    activeSheet,
    activeSuggestion,
    chartFilters,
    !isProcessingUpload && !!activeSheet
  );

  const sheetOptions = React.useMemo(() => {
    const sheets = metadataQuery.data?.sheets ?? [];
    return sheets.map((s) => ({ value: s.name, label: `${s.name} (${s.row_count.toLocaleString()} linhas)` }));
  }, [metadataQuery.data]);

  const data = activeFile ? chartDataQuery.data?.data ?? [] : [];

  const processingCard = isProcessingUpload ? (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="text-lg font-semibold">{uploadSession?.message || 'Processando arquivo...'}</div>
              <div className="text-sm text-muted-foreground">
                {uploadSession?.fileName || 'O arquivo enviado ainda esta sendo consolidado no backend.'}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(uploadSession?.progress ?? 0, 8)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Etapa: {uploadSession?.stage || 'processando'}</span>
              <span>{uploadSession?.progress ?? 0}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  ) : null;

  const renderChart = () => {
    if (isProcessingUpload) {
      return processingCard;
    }

    if (!activeSheet) {
      return (
        <ChartWrapper chartType="bar" title="Selecione uma aba" description="Escolha uma aba para ver sugestoes e graficos.">
          <div className="h-[350px] flex items-center justify-center text-sm text-muted-foreground">
            Nenhuma aba selecionada.
          </div>
        </ChartWrapper>
      );
    }

    if (suggestionsQuery.isLoading) {
      return (
        <ChartWrapper chartType="bar" title="Carregando sugestoes..." isLoading>
          <div />
        </ChartWrapper>
      );
    }

    if (suggestionsQuery.isError) {
      const msg =
        (suggestionsQuery.error as any)?.response?.data?.detail ||
        (suggestionsQuery.error as Error)?.message ||
        'Falha ao buscar sugestoes.';
      return (
        <ChartWrapper chartType="bar" title="Nao foi possivel carregar sugestoes">
          <div className="h-[350px] flex flex-col items-center justify-center text-sm text-muted-foreground text-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>{String(msg)}</div>
            <div className="text-xs">
              Voce ainda pode abrir a tabela para ver os dados brutos.
            </div>
            <Button className="mt-2" variant="outline" onClick={() => navigate(buildPath('/table'))}>
              Ver tabela
            </Button>
          </div>
        </ChartWrapper>
      );
    }

    if (!activeSuggestion) {
      return (
        <ChartWrapper
          chartType="bar"
          title="Escolha uma sugestao"
          description="Selecione um card a esquerda para renderizar um grafico com dados reais."
          filtersApplied={filterLabels}
        >
          <div className="h-[350px] flex items-center justify-center text-sm text-muted-foreground">
            Nenhuma sugestao selecionada.
          </div>
        </ChartWrapper>
      );
    }

    const dims = activeSuggestion.dimension_columns;
    const mets = activeSuggestion.metric_columns;
    const title = activeSuggestion.title;
    const description = activeSuggestion.description;
    const isLoading = chartDataQuery.isLoading;
    const isEmpty = !isLoading && data.length === 0;

    switch (activeSuggestion.chart_type) {
      case 'bar':
        return (
          <BarChart
            title={title}
            description={description}
            dataSource={selectedSheet ?? undefined}
            dimensions={dims}
            metrics={mets}
            isLoading={isLoading}
            isEmpty={isEmpty}
            data={data}
            xKey={dims[0] ?? 'x'}
            yKeys={mets}
            stacked={mets.length > 1}
            filtersApplied={filterLabels}
          />
        );
      case 'line':
      case 'area':
        return (
          <LineChart
            title={title}
            description={description}
            dataSource={selectedSheet ?? undefined}
            dimensions={dims}
            metrics={mets}
            isLoading={isLoading}
            isEmpty={isEmpty}
            data={data}
            xKey={dims[0] ?? 'x'}
            yKeys={mets}
            showArea={activeSuggestion.chart_type === 'area'}
            filtersApplied={filterLabels}
          />
        );
      case 'pie':
      case 'donut':
        return (
          <PieChart
            title={title}
            description={description}
            dataSource={selectedSheet ?? undefined}
            dimensions={dims}
            metrics={mets}
            isLoading={isLoading}
            isEmpty={isEmpty}
            data={data}
            nameKey={dims[0] ?? 'name'}
            valueKey={mets[0] ?? 'value'}
            donut={activeSuggestion.chart_type === 'donut'}
            filtersApplied={filterLabels}
          />
        );
      case 'scatter':
        return (
          <ScatterChart
            title={title}
            description={description}
            dataSource={selectedSheet ?? undefined}
            metrics={mets}
            isLoading={isLoading}
            isEmpty={isEmpty}
            data={data}
            xKey={mets[0] ?? 'x'}
            yKey={mets[1] ?? 'y'}
            filtersApplied={filterLabels}
          />
        );
      case 'radar':
        return (
          <RadarChart
            title={title}
            description={description}
            dataSource={selectedSheet ?? undefined}
            dimensions={dims}
            metrics={mets}
            isLoading={isLoading}
            isEmpty={isEmpty}
            data={data}
            angleKey={dims[0] ?? 'category'}
            valueKeys={mets}
            filtersApplied={filterLabels}
          />
        );
      case 'kpi': {
        const firstMetric = mets[0];
        const sum = data.reduce((acc, row) => acc + (Number((row as any)[firstMetric]) || 0), 0);
        return (
          <ChartWrapper
            chartType="kpi"
            title={title}
            description={description}
            dataSource={selectedSheet ?? undefined}
            metrics={mets}
            dimensions={dims}
            isLoading={isLoading}
            isEmpty={isEmpty}
            filtersApplied={filterLabels}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <KPICard title={firstMetric ?? 'KPI'} value={sum} format="decimal" />
            </div>
          </ChartWrapper>
        );
      }
      default:
        return (
          <ChartWrapper
            chartType={activeSuggestion.chart_type}
            title={title}
            description={description}
            dataSource={selectedSheet ?? undefined}
            metrics={mets}
            dimensions={dims}
            isLoading={isLoading}
            isEmpty={isEmpty}
            filtersApplied={filterLabels}
          >
            <div className="h-[350px] flex items-center justify-center text-sm text-muted-foreground">
              Tipo de grafico ainda nao suportado: {activeSuggestion.chart_type}
            </div>
          </ChartWrapper>
        );
    }
  };

  if (!fileUuid) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold">Nenhum arquivo selecionado</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Envie um arquivo na pagina de upload para gerar o dashboard.
            </p>
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
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight truncate">Dashboard</h1>
            {activeFile && (
              <div className="flex items-center gap-2">
                <Badge variant={activeFile.status === 'inconsistent' ? 'warning' : 'success'}>
                  {activeFile.status === 'inconsistent' ? 'Inconsistente' : 'OK'}
                </Badge>
                {activeFile.status === 'inconsistent' && (
                  <InconsistencyDetails report={activeFile.integrity_report} buttonLabel="Ver inconsistencias" />
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Sugestoes deterministicas de graficos (sem IA) com base no schema do arquivo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {metadataQuery.isLoading ? (
            <Skeleton className="h-10 w-[260px]" />
          ) : (
            <div className="w-[320px] max-w-[80vw]">
              <Select
                value={activeSheet ?? ''}
                onChange={(e) => setSelectedSheet(e.target.value)}
                options={sheetOptions}
              />
            </div>
          )}
          <Button variant="outline" onClick={() => navigate('/upload')}>
            <FileSpreadsheet className="h-4 w-4" />
            Novo upload
          </Button>
        </div>
      </div>

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
      ) : metadataQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
        </div>
      ) : activeFile ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Linhas" value={activeFile.total_rows} format="number" />
          <KPICard title="Colunas" value={activeFile.total_columns} format="number" />
          <KPICard title="Abas" value={activeFile.total_sheets} format="number" />
          <KPICard title="Celulas vazias" value={activeFile.integrity_report.empty_cells} format="number" />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Sugestoes
            </CardTitle>
            <CardDescription>
              Clique para renderizar um grafico com dados reais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestionsQuery.isLoading ? (
              <>
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </>
            ) : activeSheet ? (
              chartSuggestions.length === 0 ? (
                <div className="text-sm text-muted-foreground space-y-2">
                  <div>Nenhuma sugestao encontrada para esta aba.</div>
                  <Button
                    variant="outline"
                    onClick={() => navigate(buildPath('/table'))}
                  >
                    Ver tabela (dados reais)
                  </Button>
                </div>
              ) : (
                chartSuggestions.map((sug) => {
                  const isActive = activeSuggestion?.title === sug.title && activeSuggestion?.chart_type === sug.chart_type;
                  return (
                    <button
                      key={`${sug.chart_type}:${sug.title}`}
                      className={[
                        'w-full text-left rounded-lg border p-3 transition-all',
                        isActive
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border hover:border-primary/30 hover:bg-accent/30',
                      ].join(' ')}
                      onClick={() => setActiveSuggestion(sug)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{sug.title}</div>
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {sug.description}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-[10px]">
                              {sug.chart_type}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              conf: {(sug.confidence_score * 100).toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                        <div className="shrink-0 text-[10px] text-muted-foreground">
                          {sug.recommended_aggregation}
                        </div>
                      </div>
                    </button>
                  );
                })
              )
            ) : (
              <div className="text-sm text-muted-foreground">
                Selecione uma aba para carregar sugestoes com dados reais.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-8 space-y-4">
          {activeFile && activeSheet && (
            <FilterPanel
              columns={activeFile.sheets.find((sheet) => sheet.name === activeSheet)?.columns ?? []}
              affectedRows={chartDataQuery.data?.total_rows}
            />
          )}
          {renderChart()}
        </div>
      </div>
    </div>
  );
}
