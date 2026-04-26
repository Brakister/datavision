import type { FilterOperator } from '@/types';

function toPrimitive(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  const numeric = Number(trimmed.replace(',', '.'));
  if (!Number.isNaN(numeric) && /^[-+]?\d+(?:[\.,]\d+)?$/.test(trimmed)) {
    return numeric;
  }

  return trimmed;
}

export function mapFiltersToChartRequest(filters: FilterOperator[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const filter of filters) {
    const column = filter.column;

    switch (filter.operator) {
      case 'equals':
        result[column] = toPrimitive(filter.value);
        break;
      case 'in': {
        if (Array.isArray(filter.value)) {
          result[column] = filter.value.map(toPrimitive);
        } else {
          const values = String(filter.value ?? '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .map(toPrimitive);
          result[column] = values;
        }
        break;
      }
      case 'between':
        result[column] = {
          min: toPrimitive(filter.value),
          max: toPrimitive(filter.value_to),
        };
        break;
      case 'greater_than':
      case 'less_than':
      case 'contains':
      case 'not_contains':
      case 'starts_with':
      case 'ends_with':
      case 'not_equals':
      case 'is_null':
      case 'is_not_null':
      case 'not_in':
        result[column] = {
          operator: filter.operator,
          value: toPrimitive(filter.value),
          value_to: toPrimitive(filter.value_to),
        };
        break;
      default:
        result[column] = toPrimitive(filter.value);
    }
  }

  return result;
}

export function formatFilterLabel(filter: FilterOperator): string {
  const operatorLabel: Record<string, string> = {
    equals: 'igual a',
    not_equals: 'diferente de',
    contains: 'contem',
    not_contains: 'nao contem',
    starts_with: 'comeca com',
    ends_with: 'termina com',
    greater_than: 'maior que',
    less_than: 'menor que',
    between: 'entre',
    in: 'em',
    not_in: 'nao em',
    is_null: 'nulo',
    is_not_null: 'nao nulo',
  };

  const op = operatorLabel[filter.operator] || filter.operator;
  if (filter.operator === 'is_null' || filter.operator === 'is_not_null') {
    return `${filter.column} ${op}`;
  }

  if (filter.operator === 'between') {
    return `${filter.column} ${op} ${String(filter.value ?? '')} e ${String(filter.value_to ?? '')}`;
  }

  return `${filter.column} ${op} ${String(filter.value ?? '')}`;
}
