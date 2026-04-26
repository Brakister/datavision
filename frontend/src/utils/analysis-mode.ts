import type { ChartSuggestion, ColumnSchema } from '@/types';

export type AnalysisMode = 'all' | 'annual' | 'monthly' | 'daily';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

function includesKeyword(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

export function getAvailableAnalysisModes(columns: ColumnSchema[]): AnalysisMode[] {
  const normalizedNames = columns.map((column) => normalize(column.name));
  const available: AnalysisMode[] = ['all'];

  if (normalizedNames.some((name) => includesKeyword(name, ['mes', 'month', 'competencia', 'periodo', 'referencia']))) {
    available.push('monthly');
  }

  if (normalizedNames.some((name) => includesKeyword(name, ['ano', 'year', 'exercicio', 'anual']))) {
    available.push('annual');
  }

  if (normalizedNames.some((name) => includesKeyword(name, ['dia', 'day', 'data', 'date']))) {
    available.push('daily');
  }

  return available;
}

export function suggestionMatchesAnalysisMode(
  suggestion: ChartSuggestion,
  columns: ColumnSchema[],
  analysisMode: AnalysisMode
): boolean {
  if (analysisMode === 'all') return true;

  const keywordsByMode: Record<Exclude<AnalysisMode, 'all'>, string[]> = {
    monthly: ['mes', 'month', 'competencia', 'periodo', 'referencia', 'mensal', 'mensais'],
    annual: ['ano', 'year', 'exercicio', 'anual', 'anuais'],
    daily: ['dia', 'day', 'data', 'date', 'diaria', 'diario', 'diarios'],
  };

  const keywords = keywordsByMode[analysisMode];
  const normalizedTitle = normalize(suggestion.title);
  const normalizedDescription = normalize(suggestion.description);
  const relevantColumns = new Set([
    ...suggestion.dimension_columns,
    ...suggestion.metric_columns,
    ...columns.map((column) => column.name),
  ]);

  if (includesKeyword(normalizedTitle, keywords) || includesKeyword(normalizedDescription, keywords)) {
    return true;
  }

  for (const columnName of relevantColumns) {
    if (includesKeyword(normalize(columnName), keywords)) {
      return true;
    }
  }

  return false;
}

export function getAnalysisModeLabel(mode: AnalysisMode): string {
  switch (mode) {
    case 'annual':
      return 'Anual';
    case 'monthly':
      return 'Mensal';
    case 'daily':
      return 'Diaria';
    default:
      return 'Todas';
  }
}
