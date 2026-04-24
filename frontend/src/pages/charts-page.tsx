import * as React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BarChart3, FileSpreadsheet, ArrowLeft, Sparkles, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { useFileMetadata } from '@/hooks/use-file-metadata';
import { useChartSuggestions } from '@/hooks/use-chart-suggestions';
import { useChartData } from '@/hooks/use-chart-data';
import { useAppStore } from '@/stores';

import type { ChartSuggestion } from '@/types';
import { BarChart, LineChart, PieChart, ScatterChart, RadarChart, ChartWrapper, KPICard } from '@/components/charts';

export function ChartsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileUuid = searchParams.get('file');

  const {
    currentFile,
    setCurrentFile,
    selectedSheet,
    setSelectedSheet,
    chartSuggestions,
    setChartSuggestions,
  } = useAppStore();

  const metadataQuery = useFileMetadata(fileUuid);

  React.useEffect(() => {
    if (metadataQuery.data) {
      setCurrentFile(metadataQuery.data);
      if (!selectedSheet) {
        setSelectedSheet(metadataQuery.data.sheets[0]?.name ?? null);
      }
    }
  }, [metadataQuery.data, selectedSheet, setCurrentFile, setSelectedSheet]);

  const suggestionsQuery = useChartSuggestions(fileUuid, selectedSheet);

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

  const chartDataQuery = useChartData(fileUuid, selectedSheet, activeSuggestion);

  const sheetOptions = React.useMemo(() => {
    const sheets = metadataQuery.data?.sheets ?? [];
    return sheets.map((s) => ({ value: s.name, label: `${s.name} (${s.row_count.toLocaleString()} linhas)` }));
  }, [metadataQuery.data]);

  const data = chartDataQuery.data?.data ?? [];

  const renderChart = () => {
    if (!selectedSheet) {
      return (
        <ChartWrapper chartType="bar" title="Selecione uma aba" description="Escolha uma aba para ver sugestões e gráficos.">
          <div className="h-[350px] flex items-center justify-center text-sm text-muted-foreground">
            Nenhuma aba selecionada.
          </div>
        </ChartWrapper>
      );
    }

    if (suggestionsQuery.isLoading) {
      return (
        <ChartWrapper chartType="bar" title="Carregando sugestões..." isLoading>
          <div />
        </ChartWrapper>
      );
    }

    if (suggestionsQuery.isError) {
      const msg =
        (suggestionsQuery.error as any)?.response?.data?.detail ||
        (suggestionsQuery.error as Error)?.message ||
        'Falha ao buscar sugestões.';
      return (
        <ChartWrapper chartType="bar" title="Não foi possível carregar sugestões">
          <div className="h-[350px] flex flex-col items-center justify-center text-sm text-muted-foreground text-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>{String(msg)}</div>
            <div className="text-xs">
              Você ainda pode abrir a tabela para ver os dados brutos.
            </div>
            <Button className="mt-2" variant="outline" onClick={() => navigate(`/table?file=${encodeURIComponent(fileUuid!)}`)}>
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
          title="Escolha uma sugestão"
          description="Selecione um card à esquerda para renderizar um gráfico com dados reais."
        >
          <div className="h-[350px] flex items-center justify-center text-sm text-muted-foreground">
            Nenhuma sugestão selecionada.
          </div>
        </ChartWrapper>
      );
    }

    if (!activeSuggestion) return null;

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
          >
            <div className="h-[350px] flex items-center justify-center text-sm text-muted-foreground">
              Tipo de gráfico ainda não suportado: {activeSuggestion.chart_type}
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
              Envie um arquivo na página de upload para gerar o dashboard.
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
            {currentFile && (
              <Badge variant={currentFile.status === 'inconsistent' ? 'warning' : 'success'}>
                {currentFile.status === 'inconsistent' ? 'Inconsistente' : 'OK'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Sugestões determinísticas de gráficos (sem IA) com base no schema do arquivo.
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
      ) : currentFile ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Linhas" value={currentFile.total_rows} format="number" />
          <KPICard title="Colunas" value={currentFile.total_columns} format="number" />
          <KPICard title="Abas" value={currentFile.total_sheets} format="number" />
          <KPICard title="Células vazias" value={currentFile.integrity_report.empty_cells} format="number" />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Sugestões
            </CardTitle>
            <CardDescription>
              Clique para renderizar um gráfico com dados reais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestionsQuery.isLoading ? (
              <>
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </>
            ) : chartSuggestions.length === 0 ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <div>Nenhuma sugestão encontrada para esta aba.</div>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/table?file=${encodeURIComponent(fileUuid)}`)}
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
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-8">{renderChart()}</div>
      </div>
    </div>
  );
}
