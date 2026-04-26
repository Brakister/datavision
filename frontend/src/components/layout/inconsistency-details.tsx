import * as React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { IntegrityReport } from '@/types';
import { Button } from '@/components/ui/button';

interface InconsistencyDetailsProps {
  report: IntegrityReport;
  buttonLabel?: string;
  compact?: boolean;
}

function formatSeverity(value: string | undefined): string {
  if (!value) return 'nao informado';

  const normalized = value.toLowerCase();
  if (normalized === 'high') return 'alto';
  if (normalized === 'medium') return 'medio';
  if (normalized === 'low') return 'baixo';
  return normalized;
}

function formatDivergenceType(value: string | undefined): string {
  if (!value) return 'Divergencia nao classificada';

  const normalized = value.toLowerCase();
  if (normalized === 'row_count_mismatch') return 'Quantidade de linhas diferente';
  if (normalized === 'column_count_mismatch') return 'Quantidade de colunas diferente';
  if (normalized === 'sheet_missing') return 'Aba ausente em uma das leituras';
  if (normalized === 'schema_mismatch') return 'Schema divergente';

  return value.split('_').join(' ');
}

function formatWarning(value: string): string {
  const rowMismatchSheet = value.match(/^row_count_mismatch\s*\((.+)\)$/i);
  if (rowMismatchSheet) {
    return `A aba ${rowMismatchSheet[1]} teve divergencia na contagem de linhas entre as leituras.`;
  }

  return value.split('_').join(' ');
}

function formatError(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return 'Erro nao detalhado pelo backend.';
  }

  return normalized;
}

export function InconsistencyDetails({
  report,
  buttonLabel = 'Ver inconsistencias',
  compact = false,
}: InconsistencyDetailsProps) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const divergenceCount = report.engine_divergences?.length ?? 0;
  const warningCount = report.warnings?.length ?? 0;
  const errorCount = report.errors?.length ?? 0;

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon' : 'sm'}
        className={compact ? 'h-7 w-7' : ''}
        onClick={() => setOpen(true)}
        title={buttonLabel}
      >
        <AlertTriangle className="h-4 w-4" />
        {!compact && <span>{buttonLabel}</span>}
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[90] bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-[100] w-[min(90vw,900px)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border/80 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold">Pontos de inconsistencia detectados</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Divergencias entre engines e sinais de integridade para auditoria.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[70vh] overflow-auto px-5 py-4 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Divergencias encontradas</div>
                  <div className="text-xl font-semibold">{divergenceCount}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Avisos</div>
                  <div className="text-xl font-semibold">{warningCount}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Erros</div>
                  <div className="text-xl font-semibold">{errorCount}</div>
                </div>
              </div>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold">O que divergiu entre as leituras</h4>
                {divergenceCount === 0 ? (
                  <div className="text-sm text-muted-foreground rounded-lg border p-3">
                    Nenhuma divergencia detalhada foi registrada.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {report.engine_divergences.map((divergence, index) => (
                      <div key={`${divergence.type}-${divergence.sheet ?? 'global'}-${index}`} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs rounded-md border px-2 py-0.5">{formatDivergenceType(divergence.type)}</span>
                          <span className="text-xs rounded-md border px-2 py-0.5">severidade: {formatSeverity(divergence.severity)}</span>
                          {divergence.sheet && (
                            <span className="text-xs rounded-md border px-2 py-0.5">aba: {divergence.sheet}</span>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          A leitura principal encontrou {divergence.primary_rows ?? '-'} linhas e a secundária encontrou {divergence.secondary_rows ?? '-'} linhas.
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Tipo tecnico: {divergence.type}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Avisos em linguagem simples</h4>
                {warningCount === 0 ? (
                  <div className="text-sm text-muted-foreground rounded-lg border p-3">Sem avisos.</div>
                ) : (
                  <ul className="space-y-2">
                    {report.warnings.map((warning, index) => (
                      <li key={`warning-${index}`} className="rounded-lg border p-3 text-sm">
                        {formatWarning(warning)}
                        <div className="mt-1 text-xs text-muted-foreground">Codigo tecnico: {warning}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2 pb-1">
                <h4 className="text-sm font-semibold">Erros</h4>
                {errorCount === 0 ? (
                  <div className="text-sm text-muted-foreground rounded-lg border p-3">Sem erros.</div>
                ) : (
                  <ul className="space-y-2">
                    {report.errors.map((error, index) => (
                      <li key={`error-${index}`} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                        {formatError(error)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}
