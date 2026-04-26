import * as React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import {
  BarChart3,
  FileSpreadsheet,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Loader2,
  Database,
  TableProperties,
  ShieldCheck,
  BrainCircuit,
} from 'lucide-react';

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
import { analyticsService } from '@/services';
import { InconsistencyDetails } from '@/components/layout/inconsistency-details';
import { FilterPanel } from '@/components/filters/filter-panel';
import { formatFilterLabel, mapFiltersToChartRequest } from '@/utils/filter-mappers';
import {
  getAnalysisModeLabel,
  suggestionMatchesAnalysisMode,
} from '@/utils/analysis-mode';

import type { ChartSuggestion, ColumnSchema, ColumnType, SheetMetadata } from '@/types';
import { BarChart, LineChart, PieChart, ScatterChart, RadarChart, ChartWrapper, KPICard } from '@/components/charts';

const FEATURED_CHART_PRIORITY = ['line', 'area', 'bar', 'donut', 'pie', 'radar', 'scatter', 'kpi'] as const;

function getChartPriority(chartType: ChartSuggestion['chart_type']): number {
  const index = FEATURED_CHART_PRIORITY.indexOf(chartType as (typeof FEATURED_CHART_PRIORITY)[number]);
  return index === -1 ? FEATURED_CHART_PRIORITY.length : index;
}

function pickFeaturedSuggestions(suggestions: ChartSuggestion[]): ChartSuggestion[] {
  const seen = new Set<string>();

  return [...suggestions]
    .sort((left, right) => {
      const priorityDiff = getChartPriority(left.chart_type) - getChartPriority(right.chart_type);
      if (priorityDiff !== 0) return priorityDiff;
      return right.confidence_score - left.confidence_score;
    })
    .filter((suggestion) => {
      if (seen.has(suggestion.chart_type)) return false;
      seen.add(suggestion.chart_type);
      return true;
    })
    .slice(0, 4);
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Ainda nao processado';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponivel';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function shortHash(value: string | null | undefined): string {
  if (!value) return 'n/d';
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function toSentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type FinancialMetricKey = 'revenue' | 'expense' | 'result' | 'balance';

interface FinancialKpiConfig {
  key: FinancialMetricKey;
  label: string;
  metric: string;
  format: 'number' | 'currency' | 'percentage' | 'decimal';
  subtitle: string;
}

interface FinancialContext {
  hasFinancialFocus: boolean;
  availableAnalyses: string[];
  headline: string;
  description: string;
  revenueSplitPreferred: boolean;
  expenseSplitPreferred: boolean;
  kpis: FinancialKpiConfig[];
}

interface FixedFinanceMetricConfig {
  key: 'receitas' | 'despesas' | 'resultado' | 'saldos';
  title: string;
  metric: '__finance_receitas' | '__finance_despesas' | '__finance_resultado' | '__finance_saldos';
  chartType: 'line' | 'bar';
  description: string;
}

function normalizeColumnName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function includesKeyword(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function detectFinancialMetric(columns: ColumnSchema[], keywords: string[]): ColumnSchema | null {
  return (
    [...columns]
      .sort((left, right) => left.index - right.index)
      .find((column) => includesKeyword(normalizeColumnName(column.name), keywords)) ?? null
  );
}

function buildFinancialContext(sheet: SheetMetadata | null): FinancialContext {
  if (!sheet) {
    return {
      hasFinancialFocus: false,
      availableAnalyses: [],
      headline: 'Overview do dataset',
      description: 'Visao geral do arquivo, graficos principais por heuristica e exploracao detalhada por sugestao.',
      revenueSplitPreferred: false,
      expenseSplitPreferred: false,
      kpis: [],
    };
  }

  const columns = sheet.columns.filter((column) =>
    ['integer', 'float', 'decimal', 'currency', 'percentage', 'string', 'categorical', 'date', 'datetime'].includes(column.detected_type)
  );

  const revenue = detectFinancialMetric(columns, [
    'receita', 'faturamento', 'entrada', 'venda', 'receb', 'credito',
    'pix', 'boleto', 'cartao', 'ted', 'doc', 'transferencia', 'dinheiro',
  ]);
  const expense = detectFinancialMetric(columns, [
    'despesa', 'custo', 'gasto', 'saida', 'pag', 'pagamentos', 'debito',
    'boleto', 'pix', 'cartao', 'ted', 'doc', 'transferencia', 'dinheiro',
  ]);
  const result = detectFinancialMetric(columns, ['superavit', 'deficit', 'resultado', 'lucro', 'prejuizo']);
  const balance = detectFinancialMetric(columns, ['saldo', 'caixa', 'disponivel', 'acumulado']);

  const normalizedNames = columns.map((column) => normalizeColumnName(column.name));
  const hasMonthly = normalizedNames.some((name) => includesKeyword(name, ['mes', 'month', 'competencia', 'periodo', 'referencia']));
  const hasYearly = normalizedNames.some((name) => includesKeyword(name, ['ano', 'year', 'exercicio', 'anual']));
  const hasDaily = normalizedNames.some((name) => includesKeyword(name, ['dia', 'day', 'data', 'date']));
  const revenueSplitPreferred = normalizedNames.some((name) => includesKeyword(name, [
    'status_receita', 'origem_receita', 'tipo_receita', 'receita', 'pagamento',
    'forma', 'meio', 'pix', 'boleto', 'cartao', 'ted', 'doc', 'transferencia', 'dinheiro',
  ])) &&
    Boolean(revenue);
  const expenseSplitPreferred = normalizedNames.some((name) => includesKeyword(name, [
    'categoria_despesa', 'tipo_despesa', 'natureza', 'grupo', 'centro', 'pagamento',
    'forma', 'meio', 'pix', 'boleto', 'cartao', 'ted', 'doc', 'transferencia', 'dinheiro',
  ])) &&
    Boolean(expense || result);

  const kpis: FinancialKpiConfig[] = [];
  if (revenue) {
    kpis.push({ key: 'revenue', label: 'Receitas', metric: revenue.name, format: 'currency', subtitle: 'Total consolidado da aba atual' });
  }
  if (expense) {
    kpis.push({ key: 'expense', label: 'Despesas', metric: expense.name, format: 'currency', subtitle: 'Saidas consolidadas da aba atual' });
  }
  if (result) {
    kpis.push({ key: 'result', label: 'Deficit / superavit', metric: result.name, format: 'currency', subtitle: 'Resultado acumulado da aba atual' });
  }
  if (balance) {
    kpis.push({ key: 'balance', label: 'Saldos', metric: balance.name, format: 'currency', subtitle: 'Saldo agregado disponivel' });
  }

  const availableAnalyses = [
    hasMonthly ? 'mensal' : null,
    hasYearly ? 'anual' : null,
    hasDaily ? 'diaria' : null,
  ].filter(Boolean) as string[];

  const hasFinancialFocus = Boolean(revenue || expense || result || balance);

  return {
    hasFinancialFocus,
    availableAnalyses,
    headline: hasFinancialFocus ? 'Painel financeiro' : 'Overview do dataset',
    description: hasFinancialFocus
      ? 'Prioriza receitas, despesas, deficit/superavit, saldos e composicoes financeiras detectadas no arquivo.'
      : 'Visao geral do arquivo, graficos principais por heuristica e exploracao detalhada por sugestao.',
    revenueSplitPreferred,
    expenseSplitPreferred,
    kpis: kpis.slice(0, 4),
  };
}

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
    selectedAnalysisMode,
  } = useAppStore();

  const activeFile = currentFile?.uuid === fileUuid ? currentFile : null;
  const activeSheet = activeFile ? selectedSheet : null;
  const activeSheetMeta = activeFile?.sheets.find((sheet) => sheet.name === activeSheet) ?? null;
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

  const visibleSuggestions = React.useMemo(() => {
    if (!activeSheetMeta) return chartSuggestions;

    const filtered = chartSuggestions.filter((suggestion) =>
      suggestionMatchesAnalysisMode(suggestion, activeSheetMeta.columns, selectedAnalysisMode)
    );

    return filtered.length > 0 ? filtered : chartSuggestions;
  }, [activeSheetMeta, chartSuggestions, selectedAnalysisMode]);

  React.useEffect(() => {
    if (visibleSuggestions.length === 0) {
      setActiveSuggestion(null);
      return;
    }

    const stillExists = activeSuggestion
      ? visibleSuggestions.some(
          (suggestion) =>
            suggestion.title === activeSuggestion.title &&
            suggestion.chart_type === activeSuggestion.chart_type
        )
      : false;

    if (!activeSuggestion || !stillExists) {
      setActiveSuggestion(visibleSuggestions[0]);
    }
  }, [activeSuggestion, visibleSuggestions]);

  const chartFilters = React.useMemo(() => mapFiltersToChartRequest(activeFilters), [activeFilters]);
  const filterLabels = React.useMemo(() => activeFilters.map(formatFilterLabel), [activeFilters]);

  const chartDataQuery = useChartData(
    fileUuid,
    activeSheet,
    activeSuggestion,
    chartFilters,
    !isProcessingUpload && !!activeSheet
  );

  const featuredSuggestions = React.useMemo(() => pickFeaturedSuggestions(visibleSuggestions), [visibleSuggestions]);

  const featuredQueries = useQueries({
    queries: featuredSuggestions.map((suggestion) => ({
      queryKey: ['overview-chart-data', fileUuid, activeSheet, suggestion, chartFilters],
      queryFn: () =>
        analyticsService.getChartData({
          file_uuid: fileUuid!,
          sheet_name: activeSheet!,
          chart_type: suggestion.chart_type,
          dimension_columns: suggestion.dimension_columns,
          metric_columns: suggestion.metric_columns,
          aggregation: suggestion.recommended_aggregation,
          filters: chartFilters,
          limit: 1000,
        }),
      enabled: !!fileUuid && !!activeSheet && !isProcessingUpload,
      staleTime: 1000 * 60 * 2,
    })),
  });

  const featuredCharts = React.useMemo(
    () => featuredSuggestions.map((suggestion, index) => ({ suggestion, query: featuredQueries[index] })),
    [featuredQueries, featuredSuggestions]
  );

  const financialContext = React.useMemo(() => buildFinancialContext(activeSheetMeta), [activeSheetMeta]);

  const financialKpiQueries = useQueries({
    queries: financialContext.kpis.map((kpi) => ({
      queryKey: ['financial-kpi', fileUuid, activeSheet, kpi.metric, chartFilters],
      queryFn: () =>
        analyticsService.getChartData({
          file_uuid: fileUuid!,
          sheet_name: activeSheet!,
          chart_type: 'kpi',
          dimension_columns: [],
          metric_columns: [kpi.metric],
          aggregation: 'sum',
          filters: chartFilters,
          limit: 1,
        }),
      enabled: !!fileUuid && !!activeSheet && !isProcessingUpload,
      staleTime: 1000 * 60 * 2,
    })),
  });

  const financialKpiCards = React.useMemo(
    () =>
      financialContext.kpis.map((kpi, index) => {
        const query = financialKpiQueries[index];
        const row = query?.data?.data?.[0] as Record<string, unknown> | undefined;
        return {
          ...kpi,
          value: Number(row?.[kpi.metric] ?? 0),
          isLoading: query?.isLoading ?? false,
        };
      }),
    [financialContext.kpis, financialKpiQueries]
  );

  const fixedFinanceMetrics = React.useMemo<FixedFinanceMetricConfig[]>(
    () => [
      {
        key: 'receitas',
        title: 'Receitas por mes (fixo)',
        metric: '__finance_receitas',
        chartType: 'line',
        description: 'Serie mensal de receitas extraida do fluxo, sem depender de sugestoes.',
      },
      {
        key: 'despesas',
        title: 'Despesas por mes (fixo)',
        metric: '__finance_despesas',
        chartType: 'bar',
        description: 'Serie mensal de despesas extraida do fluxo, sem depender de sugestoes.',
      },
      {
        key: 'resultado',
        title: 'Resultado liquido por mes (fixo)',
        metric: '__finance_resultado',
        chartType: 'line',
        description: 'Linha de (=) Resultado Liquido por mes usando o total de cada bloco.',
      },
      {
        key: 'saldos',
        title: 'Total por mes (fixo)',
        metric: '__finance_saldos',
        chartType: 'bar',
        description: 'Total mensal a partir da linha de saldos/total da planilha.',
      },
    ],
    []
  );

  const fixedFinanceQueries = useQueries({
    queries: fixedFinanceMetrics.map((config) => ({
      queryKey: ['fixed-finance-panel', fileUuid, activeSheet, config.metric],
      queryFn: () =>
        analyticsService.getChartData({
          file_uuid: fileUuid!,
          sheet_name: activeSheet!,
          chart_type: config.chartType,
          dimension_columns: ['__month'],
          metric_columns: [config.metric],
          aggregation: 'sum',
          limit: 100,
        }),
      enabled: !!fileUuid && !!activeSheet && !isProcessingUpload,
      staleTime: 1000 * 60 * 2,
    })),
  });

  const fixedFinanceCards = React.useMemo(
    () =>
      fixedFinanceMetrics.map((metric, index) => {
        const query = fixedFinanceQueries[index];
        const rows = (query?.data?.data ?? []) as Array<Record<string, unknown>>;
        const latestRow = rows.length > 0 ? rows[rows.length - 1] : undefined;
        const latestMonth = String(latestRow?.__month ?? 'n/d');
        const latestValue = Number(latestRow?.[metric.metric] ?? 0);

        return {
          ...metric,
          query,
          rows,
          latestMonth,
          latestValue,
        };
      }),
    [fixedFinanceMetrics, fixedFinanceQueries]
  );

  const sheetOptions = React.useMemo(() => {
    const sheets = metadataQuery.data?.sheets ?? [];
    return sheets.map((sheet) => ({
      value: sheet.name,
      label: `${sheet.name} (${sheet.row_count.toLocaleString()} linhas)`,
    }));
  }, [metadataQuery.data]);

  const topSheets = React.useMemo(
    () =>
      [...(activeFile?.sheets ?? [])]
        .sort((left, right) => right.row_count - left.row_count)
        .slice(0, 5),
    [activeFile]
  );

  const typeSummary = React.useMemo(
    () =>
      Object.entries(activeFile?.integrity_report.columns_by_type ?? {})
        .sort((left, right) => Number(right[1]) - Number(left[1]))
        .slice(0, 5),
    [activeFile]
  );

  const insightCards = React.useMemo(() => {
    if (!activeFile) return [];

    const insights: Array<{ title: string; tone: 'default' | 'success' | 'warning'; description: string; meta: string }> = [];

    if (financialContext.hasFinancialFocus) {
      insights.push({
        title: 'Leitura financeira prioritaria',
        tone: 'success',
        description:
          financialContext.availableAnalyses.length > 0
            ? `Analises ${financialContext.availableAnalyses.join(', ')} detectadas na aba atual.`
            : 'A aba atual contem metricas financeiras relevantes para acompanhamento gerencial.',
        meta: [
          financialContext.revenueSplitPreferred ? 'receitas por composicao' : null,
          financialContext.expenseSplitPreferred ? 'despesas por categoria' : null,
        ]
          .filter(Boolean)
          .join(' | ') || 'receitas, despesas, resultado e saldos foram priorizados nas sugestoes.',
      });
    }

    if (selectedAnalysisMode !== 'all') {
      insights.push({
        title: 'Forma de analise ativa',
        tone: 'default',
        description: `O dashboard esta priorizando a leitura ${getAnalysisModeLabel(selectedAnalysisMode).toLowerCase()}.`,
        meta: `${visibleSuggestions.length} sugestao(oes) compativeis com esse recorte na aba atual.`,
      });
    }

    if (visibleSuggestions[0]) {
      insights.push({
        title: 'Melhor sugestao automatica',
        tone: 'success',
        description: visibleSuggestions[0].description,
        meta: `Tipo ${visibleSuggestions[0].chart_type} com confianca de ${(visibleSuggestions[0].confidence_score * 100).toFixed(0)}%.`,
      });
    }

    if (activeFile.integrity_report.mixed_type_columns.length > 0) {
      insights.push({
        title: 'Colunas com tipo misto',
        tone: 'warning',
        description: `${activeFile.integrity_report.mixed_type_columns.length} coluna(s) podem exigir filtros ou leitura cuidadosa.`,
        meta: activeFile.integrity_report.mixed_type_columns.slice(0, 3).join(', '),
      });
    }

    if ((activeFile.integrity_report.engine_divergences?.length ?? 0) > 0) {
      insights.push({
        title: 'Divergencias entre engines',
        tone: 'warning',
        description: `Foram encontradas ${activeFile.integrity_report.engine_divergences.length} divergencia(s) na validacao multi-engine.`,
        meta: 'Abra o detalhe de inconsistencias para auditoria completa.',
      });
    }

    insights.push({
      title: 'Cobertura do dataset',
      tone: 'default',
      description: `${activeFile.total_rows.toLocaleString()} linhas distribuidas em ${activeFile.total_sheets} aba(s).`,
      meta: `${activeFile.total_columns.toLocaleString()} colunas e ${activeFile.integrity_report.empty_cells.toLocaleString()} celulas vazias.`,
    });

    return insights.slice(0, 4);
  }, [activeFile, financialContext, selectedAnalysisMode, visibleSuggestions]);

  const detectMetricFormat = React.useCallback(
    (metric?: string): 'number' | 'currency' | 'percentage' | 'decimal' => {
      const columnType = activeSheetMeta?.columns.find((column) => column.name === metric)?.detected_type;
      const mapped: Partial<Record<ColumnType, 'number' | 'currency' | 'percentage' | 'decimal'>> = {
        currency: 'currency',
        percentage: 'percentage',
        decimal: 'decimal',
        float: 'decimal',
      };

      return (columnType && mapped[columnType]) || 'number';
    },
    [activeSheetMeta]
  );

  const renderSuggestionChart = React.useCallback(
    (
      suggestion: ChartSuggestion | null,
      query: {
        data?: { data: Array<Record<string, unknown>> };
        isLoading: boolean;
        isError: boolean;
        error: unknown;
      },
      options?: { compact?: boolean }
    ) => {
      if (!suggestion) {
        return (
          <ChartWrapper
            chartType="bar"
            title="Aguardando sugestao"
            description="Selecione uma sugestao para visualizar dados reais."
            filtersApplied={filterLabels}
          >
            <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
              Nenhuma sugestao selecionada.
            </div>
          </ChartWrapper>
        );
      }

      const dims = suggestion.dimension_columns;
      const metrics = suggestion.metric_columns;
      const data = query.data?.data ?? [];
      const isEmpty = !query.isLoading && data.length === 0;

      if (query.isError) {
        const message =
          (query.error as any)?.response?.data?.detail ||
          (query.error as Error)?.message ||
          'Nao foi possivel carregar os dados desta visualizacao.';

        return (
          <ChartWrapper
            chartType={suggestion.chart_type}
            title={suggestion.title}
            description={suggestion.description}
            dataSource={activeSheet ?? undefined}
            dimensions={dims}
            metrics={metrics}
            filtersApplied={filterLabels}
          >
            <div className="flex h-[350px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>{String(message)}</div>
            </div>
          </ChartWrapper>
        );
      }

      switch (suggestion.chart_type) {
        case 'bar':
          return (
            <BarChart
              title={suggestion.title}
              description={suggestion.description}
              dataSource={activeSheet ?? undefined}
              dimensions={dims}
              metrics={metrics}
              isLoading={query.isLoading}
              isEmpty={isEmpty}
              data={data}
              xKey={dims[0] ?? 'x'}
              yKeys={metrics}
              stacked={metrics.length > 1}
              horizontal={Boolean(options?.compact && data.length <= 8)}
              filtersApplied={filterLabels}
            />
          );
        case 'line':
        case 'area':
          return (
            <LineChart
              title={suggestion.title}
              description={suggestion.description}
              dataSource={activeSheet ?? undefined}
              dimensions={dims}
              metrics={metrics}
              isLoading={query.isLoading}
              isEmpty={isEmpty}
              data={data}
              xKey={dims[0] ?? 'x'}
              yKeys={metrics}
              showArea={suggestion.chart_type === 'area'}
              filtersApplied={filterLabels}
            />
          );
        case 'pie':
        case 'donut':
          return (
            <PieChart
              title={suggestion.title}
              description={suggestion.description}
              dataSource={activeSheet ?? undefined}
              dimensions={dims}
              metrics={metrics}
              isLoading={query.isLoading}
              isEmpty={isEmpty}
              data={data}
              nameKey={dims[0] ?? 'name'}
              valueKey={metrics[0] ?? 'value'}
              donut={suggestion.chart_type === 'donut'}
              filtersApplied={filterLabels}
            />
          );
        case 'scatter':
          return (
            <ScatterChart
              title={suggestion.title}
              description={suggestion.description}
              dataSource={activeSheet ?? undefined}
              metrics={metrics}
              isLoading={query.isLoading}
              isEmpty={isEmpty}
              data={data}
              xKey={metrics[0] ?? 'x'}
              yKey={metrics[1] ?? metrics[0] ?? 'y'}
              filtersApplied={filterLabels}
            />
          );
        case 'radar':
          return (
            <RadarChart
              title={suggestion.title}
              description={suggestion.description}
              dataSource={activeSheet ?? undefined}
              dimensions={dims}
              metrics={metrics}
              isLoading={query.isLoading}
              isEmpty={isEmpty}
              data={data}
              angleKey={dims[0] ?? 'category'}
              valueKeys={metrics}
              filtersApplied={filterLabels}
            />
          );
        case 'kpi': {
          const firstMetric = metrics[0];
          const sum = data.reduce((accumulator, row) => accumulator + (Number((row as Record<string, unknown>)[firstMetric ?? '']) || 0), 0);
          return (
            <ChartWrapper
              chartType="kpi"
              title={suggestion.title}
              description={suggestion.description}
              dataSource={activeSheet ?? undefined}
              dimensions={dims}
              metrics={metrics}
              isLoading={query.isLoading}
              isEmpty={isEmpty}
              filtersApplied={filterLabels}
            >
              <div className="grid grid-cols-1 gap-4">
                <KPICard
                  title={firstMetric ?? 'KPI'}
                  value={sum}
                  format={detectMetricFormat(firstMetric)}
                />
              </div>
            </ChartWrapper>
          );
        }
        default:
          return (
            <ChartWrapper
              chartType={suggestion.chart_type}
              title={suggestion.title}
              description={suggestion.description}
              dataSource={activeSheet ?? undefined}
              dimensions={dims}
              metrics={metrics}
              isLoading={query.isLoading}
              isEmpty={isEmpty}
              filtersApplied={filterLabels}
            >
              <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
                Tipo de grafico ainda nao suportado: {suggestion.chart_type}
              </div>
            </ChartWrapper>
          );
      }
    },
    [activeSheet, detectMetricFormat, filterLabels]
  );

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
            <h1 className="text-xl font-semibold tracking-tight truncate">{financialContext.headline}</h1>
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
            {financialContext.description}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {metadataQuery.isLoading ? (
            <Skeleton className="h-10 w-[260px]" />
          ) : (
            <div className="w-[320px] max-w-[80vw]">
              <Select
                value={activeSheet ?? ''}
                onChange={(event) => setSelectedSheet(event.target.value)}
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
      ) : null}

      {isProcessingUpload ? (
        processingCard
      ) : metadataQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
        </div>
      ) : activeFile ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {financialKpiCards.length > 0 ? (
              <>
                {financialKpiCards.map((card) => (
                  <KPICard
                    key={card.key}
                    title={card.label}
                    value={card.value}
                    format={card.format}
                    subtitle={card.subtitle}
                    isLoading={card.isLoading}
                  />
                ))}
                {financialKpiCards.length < 5 && (
                  <KPICard
                    title="Linhas"
                    value={activeFile.total_rows}
                    format="number"
                    subtitle="Volume total da aba analisada"
                  />
                )}
              </>
            ) : (
              <>
                <KPICard title="Linhas" value={activeFile.total_rows} format="number" subtitle="Volume total do arquivo" />
                <KPICard title="Colunas" value={activeFile.total_columns} format="number" subtitle="Schema consolidado" />
                <KPICard title="Abas" value={activeFile.total_sheets} format="number" subtitle="Estrutura detectada" />
                <KPICard
                  title="Celulas vazias"
                  value={activeFile.integrity_report.empty_cells}
                  format="number"
                  subtitle="Campos sem preenchimento"
                />
                <KPICard
                  title="Formulas detectadas"
                  value={activeFile.integrity_report.formulas_detected}
                  format="number"
                  subtitle="Indicios de planilha calculada"
                />
              </>
            )}
          </div>

          {activeSheetMeta && (
            <FilterPanel
              columns={activeSheetMeta.columns}
              affectedRows={activeSuggestion ? chartDataQuery.data?.total_rows : undefined}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Aba fixa mensal (independente de sugestoes)</CardTitle>
              <CardDescription>
                Receitas, Despesas, Resultado Liquido e Total por mes extraidos diretamente do fluxo de caixa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {fixedFinanceCards.map((card) => (
                  <KPICard
                    key={card.key}
                    title={`${card.title.replace(' por mes (fixo)', '')} - ultimo mes`}
                    value={card.latestValue}
                    format="currency"
                    subtitle={card.latestMonth}
                    isLoading={Boolean(card.query?.isLoading)}
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {fixedFinanceCards.map((card) => {
                  const hasError = Boolean(card.query?.isError);
                  const isLoading = Boolean(card.query?.isLoading);
                  const isEmpty = !isLoading && card.rows.length === 0;

                  if (hasError) {
                    return (
                      <ChartWrapper
                        key={card.key}
                        chartType={card.chartType}
                        title={card.title}
                        description={card.description}
                      >
                        <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                          Nao foi possivel carregar este indicador fixo.
                        </div>
                      </ChartWrapper>
                    );
                  }

                  if (card.chartType === 'line') {
                    return (
                      <LineChart
                        key={card.key}
                        title={card.title}
                        description={card.description}
                        dataSource={activeSheet ?? undefined}
                        dimensions={['__month']}
                        metrics={[card.metric]}
                        isLoading={isLoading}
                        isEmpty={isEmpty}
                        data={card.rows}
                        xKey="__month"
                        yKeys={[card.metric]}
                      />
                    );
                  }

                  return (
                    <BarChart
                      key={card.key}
                      title={card.title}
                      description={card.description}
                      dataSource={activeSheet ?? undefined}
                      dimensions={['__month']}
                      metrics={[card.metric]}
                      isLoading={isLoading}
                      isEmpty={isEmpty}
                      data={card.rows}
                      xKey="__month"
                      yKeys={[card.metric]}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8">
              {featuredCharts[0]
                ? renderSuggestionChart(featuredCharts[0].suggestion, featuredCharts[0].query, { compact: false })
                : suggestionsQuery.isLoading ? (
                  <Card>
                    <CardContent className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
                      Aguarde o carregamento das sugestoes para montar o overview.
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="flex h-[420px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground text-center">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      <div>
                        {selectedAnalysisMode === 'all'
                          ? 'Nao encontramos sugestoes graficas automaticas para a aba atual.'
                          : `Nao encontramos sugestoes para a analise ${getAnalysisModeLabel(selectedAnalysisMode).toLowerCase()} na aba atual.`}
                      </div>
                      <div className="max-w-xl text-xs">
                        Isso normalmente acontece quando a planilha nao tem combinacao suficiente de colunas temporais,
                        categorias e metricas numericas reconhecidas para montar o grafico automaticamente.
                      </div>
                      <Button variant="outline" onClick={() => navigate(buildPath('/table'))}>
                        Ver tabela (dados reais)
                      </Button>
                    </CardContent>
                  </Card>
                )}
            </div>

            <div className="xl:col-span-4 space-y-6">
              {featuredCharts[1]
                ? renderSuggestionChart(featuredCharts[1].suggestion, featuredCharts[1].query, { compact: true })
                : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-primary" />
                        {financialContext.hasFinancialFocus ? 'Resumo financeiro' : 'Resumo do arquivo'}
                      </CardTitle>
                      <CardDescription>
                        {financialContext.hasFinancialFocus
                          ? 'Contexto rapido do arquivo e da leitura financeira priorizada.'
                          : 'Informacoes gerais para leitura rapida.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Arquivo</span>
                        <span className="font-medium text-right">{activeFile.original_filename}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Formato</span>
                        <Badge variant="outline">{activeFile.file_format.toUpperCase()}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Processado em</span>
                        <span>{formatTimestamp(activeFile.processed_at || activeFile.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Hash</span>
                        <span className="font-mono text-xs">{shortHash(activeFile.file_hash_sha256)}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    {financialContext.hasFinancialFocus ? 'Saude e cobertura financeira' : 'Saude dos dados'}
                  </CardTitle>
                  <CardDescription>
                    {financialContext.hasFinancialFocus
                      ? 'Validacao estrutural e disponibilidade para leituras mensal, anual e diaria.'
                      : 'Resumo rapido do que o arquivo trouxe de validacao.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    {(activeFile.integrity_report.engines_used ?? []).map((engine) => (
                      <Badge key={engine} variant="outline">{engine}</Badge>
                    ))}
                    {activeFile.strict_mode && <Badge variant="secondary">Modo estrito</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Divergencias</div>
                      <div className="text-xl font-semibold">{activeFile.integrity_report.engine_divergences.length}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Avisos</div>
                      <div className="text-xl font-semibold">{activeFile.integrity_report.warnings.length}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {activeFile.integrity_report.strict_mode_blocked
                      ? 'O modo estrito sinalizou bloqueio potencial para parte do pipeline.'
                      : 'Nenhum bloqueio estrutural foi sinalizado pelo modo estrito.'}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-6">
              {featuredCharts[2]
                ? renderSuggestionChart(featuredCharts[2].suggestion, featuredCharts[2].query, { compact: true })
                : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TableProperties className="h-4 w-4 text-primary" />
                        {financialContext.hasFinancialFocus ? 'Analises disponiveis' : 'Abas com mais linhas'}
                      </CardTitle>
                      <CardDescription>
                        {financialContext.hasFinancialFocus
                          ? 'Recortes encontrados para o painel financeiro principal.'
                          : 'Priorizacao natural das principais abas do arquivo.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {financialContext.hasFinancialFocus ? (
                        <>
                          <div className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                            <div>
                              <div className="font-medium">Analises detectadas</div>
                              <div className="text-xs text-muted-foreground">
                                {financialContext.availableAnalyses.length > 0
                                  ? financialContext.availableAnalyses.join(', ')
                                  : 'Sem recorte temporal claro na aba atual'}
                              </div>
                            </div>
                            <Badge variant="secondary">{activeSheetMeta?.name ?? 'Aba atual'}</Badge>
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                            <div>
                              <div className="font-medium">Pizzas priorizadas</div>
                              <div className="text-xs text-muted-foreground">Receitas e despesas por composicao</div>
                            </div>
                            <Badge variant={financialContext.revenueSplitPreferred || financialContext.expenseSplitPreferred ? 'success' : 'outline'}>
                              {financialContext.revenueSplitPreferred || financialContext.expenseSplitPreferred ? 'Prontas' : 'Parcial'}
                            </Badge>
                          </div>
                        </>
                      ) : (
                        topSheets.map((sheet) => (
                          <div key={sheet.name} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                            <div>
                              <div className="font-medium">{sheet.name}</div>
                              <div className="text-xs text-muted-foreground">{sheet.column_count.toLocaleString()} colunas</div>
                            </div>
                            <Badge variant="secondary">{sheet.row_count.toLocaleString()} linhas</Badge>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                )}
            </div>

            <div className="xl:col-span-6">
              {featuredCharts[3]
                ? renderSuggestionChart(featuredCharts[3].suggestion, featuredCharts[3].query, { compact: true })
                : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-primary" />
                        {financialContext.hasFinancialFocus ? 'Cobertura das metricas' : 'Tipos de coluna'}
                      </CardTitle>
                      <CardDescription>
                        {financialContext.hasFinancialFocus
                          ? 'Como o schema atual sustenta receitas, despesas, saldos e composicoes.'
                          : 'Distribuicao dos tipos detectados na aba atual.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {typeSummary.map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                          <span>{toSentenceCase(type)}</span>
                          <Badge variant="outline">{Number(count).toLocaleString()}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <Card className="xl:col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Sugestoes
                </CardTitle>
                <CardDescription>
                  {financialContext.hasFinancialFocus
                    ? 'Selecione uma sugestao para abrir a visualizacao financeira detalhada.'
                    : 'Selecione uma sugestao para abrir a visualizacao detalhada.'}
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
                  visibleSuggestions.length === 0 ? (
                    <div className="text-sm text-muted-foreground space-y-2">
                      <div>
                        {selectedAnalysisMode === 'all'
                          ? 'Nenhuma sugestao encontrada para esta aba.'
                          : `Nenhuma sugestao encontrada para a analise ${getAnalysisModeLabel(selectedAnalysisMode).toLowerCase()} nesta aba.`}
                      </div>
                      <Button variant="outline" onClick={() => navigate(buildPath('/table'))}>
                        Ver tabela (dados reais)
                      </Button>
                    </div>
                  ) : (
                    visibleSuggestions.map((suggestion) => {
                      const isActive =
                        activeSuggestion?.title === suggestion.title &&
                        activeSuggestion?.chart_type === suggestion.chart_type;

                      return (
                        <button
                          key={`${suggestion.chart_type}:${suggestion.title}`}
                          className={[
                            'w-full rounded-lg border p-3 text-left transition-all',
                            isActive
                              ? 'border-primary/50 bg-primary/10'
                              : 'border-border hover:border-primary/30 hover:bg-accent/30',
                          ].join(' ')}
                          onClick={() => setActiveSuggestion(suggestion)}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{suggestion.title}</div>
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {suggestion.description}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                <Badge variant="secondary" className="text-[10px]">
                                  {suggestion.chart_type}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  conf: {(suggestion.confidence_score * 100).toFixed(0)}%
                                </Badge>
                              </div>
                            </div>
                            <div className="shrink-0 text-[10px] text-muted-foreground">
                              {suggestion.recommended_aggregation}
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

            <div className="xl:col-span-8">
              {renderSuggestionChart(activeSuggestion, chartDataQuery)}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-primary" />
                {financialContext.hasFinancialFocus ? 'Insights financeiros deterministicos' : 'Insights deterministicos'}
              </CardTitle>
              <CardDescription>
                Leitura orientada por heuristicas do arquivo e do pipeline de validacao.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {insightCards.map((insight) => (
                <div
                  key={insight.title}
                  className={[
                    'rounded-xl border p-4',
                    insight.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/5' : '',
                    insight.tone === 'warning' ? 'border-amber-500/30 bg-amber-500/5' : '',
                  ].join(' ')}
                >
                  <div className="mb-2">
                    <Badge variant={insight.tone === 'warning' ? 'warning' : insight.tone === 'success' ? 'success' : 'secondary'}>
                      {insight.title}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium">{insight.description}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{insight.meta}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
