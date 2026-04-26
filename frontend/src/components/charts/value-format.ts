export type ValueKind = 'currency' | 'percentage' | 'number';

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export function inferValueKind(metricName: string): ValueKind {
  const key = normalize(metricName);

  if (
    key.includes('percent') ||
    key.includes('perc') ||
    key.includes('taxa') ||
    key.includes('ratio') ||
    key.endsWith('_pct') ||
    key.endsWith('_percent')
  ) {
    return 'percentage';
  }

  if (
    key.includes('valor') ||
    key.includes('preco') ||
    key.includes('preco') ||
    key.includes('receita') ||
    key.includes('despesa') ||
    key.includes('saldo') ||
    key.includes('superavit') ||
    key.includes('deficit') ||
    key.includes('imposto') ||
    key.includes('folha') ||
    key.includes('pagamento') ||
    key.includes('pagamentos') ||
    key.includes('pix') ||
    key.includes('boleto') ||
    key.includes('cartao') ||
    key.includes('ted') ||
    key.includes('doc') ||
    key.includes('transferencia') ||
    key.includes('dinheiro') ||
    key.includes('credito') ||
    key.includes('debito') ||
    key.includes('faturamento') ||
    key.includes('custo') ||
    key.includes('total') ||
    key.includes('amount') ||
    key.includes('price') ||
    key.includes('revenue')
  ) {
    return 'currency';
  }

  return 'number';
}

export function formatMetricValue(value: unknown, metricName: string): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return String(value ?? '');
  }

  const kind = inferValueKind(metricName);
  if (kind === 'percentage') {
    return `${numeric.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })}%`;
  }

  if (kind === 'currency') {
    return numeric.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2,
    });
  }

  return numeric.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
  });
}
