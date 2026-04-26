import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react';
import { AxiosError } from 'axios';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { uploadService } from '@/services';
import { useAppStore } from '@/stores';
import { useFileMetadata } from '@/hooks/use-file-metadata';
import { InconsistencyDetails } from '@/components/layout/inconsistency-details';

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ['xlsx', 'xls', 'xlsm', 'xlsb', 'csv', 'tsv', 'ods'];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value.toFixed(power === 0 ? 0 : 2)} ${units[power]}`;
}

function toFriendlyError(error: unknown): string {
  if (error instanceof AxiosError) {
    const detail = (error.response?.data as { detail?: string })?.detail;
    const code = (error.response?.data as { error_code?: string })?.error_code;

    if (code === 'UNSUPPORTED_FORMAT') {
      return 'Formato invalido. Envie CSV, TSV, XLSX, XLS, XLSM, XLSB ou ODS.';
    }
    if (code === 'FILE_TOO_LARGE') {
      return 'Arquivo maior que 500MB. Selecione um arquivo menor.';
    }
    if (code === 'INCONSISTENT_FILE') {
      return 'Inconsistencias detectadas no arquivo em modo estrito.';
    }
    if (detail) {
      return detail;
    }
  }

  return 'Nao foi possivel enviar o arquivo. Tente novamente.';
}

export function UploadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedFile = useAppStore((state) => state.uploadDraftFile);
  const setSelectedFile = useAppStore((state) => state.setUploadDraftFile);
  const strictMode = useAppStore((state) => state.uploadDraftStrictMode);
  const setStrictMode = useAppStore((state) => state.setUploadDraftStrictMode);
  const uploadSession = useAppStore((state) => state.uploadSession);
  const setUploadSession = useAppStore((state) => state.setUploadSession);
  const updateUploadSession = useAppStore((state) => state.updateUploadSession);
  const clearUploadSession = useAppStore((state) => state.clearUploadSession);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isProcessing = uploadSession?.status === 'processing';
  const visibleProgress = uploadSession?.progress ?? 0;
  const visibleMessage = uploadSession?.message ?? 'Pronto para enviar';
  const visibleStage = uploadSession?.stage ?? 'idle';
  const inconsistentFileUuid = uploadSession?.status === 'inconsistent' ? uploadSession.fileUuid : null;
  const inconsistentMetadataQuery = useFileMetadata(inconsistentFileUuid, !!inconsistentFileUuid);

  const fileExtension = useMemo(() => {
    if (!selectedFile) return '';
    const parts = selectedFile.name.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }, [selectedFile]);

  const dropzone = useDropzone({
    multiple: false,
    noClick: false,
    noKeyboard: false,
    onDropAccepted: (files) => {
      if (isProcessing) {
        setErrorMessage('Existe um processamento em andamento. Aguarde concluir antes de trocar o arquivo.');
        return;
      }

      const file = files[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setSelectedFile(null);
        setErrorMessage('Arquivo maior que 500MB. Selecione um arquivo menor.');
        return;
      }

      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!SUPPORTED_EXTENSIONS.includes(extension)) {
        setSelectedFile(null);
        setErrorMessage('Formato invalido. Envie CSV, TSV, XLSX, XLS, XLSM, XLSB ou ODS.');
        return;
      }

      clearUploadSession();
      setSelectedFile(file);
      setErrorMessage(null);
    },
    onDropRejected: () => {
      if (isProcessing) return;
      setSelectedFile(null);
      setErrorMessage('Nao foi possivel ler o arquivo. Verifique formato e tamanho.');
    },
    accept: {
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12': ['.xlsb'],
      'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
    },
    maxSize: MAX_FILE_SIZE_BYTES,
  });

  const handleUpload = async () => {
    if (!selectedFile || isProcessing) return;

    setErrorMessage(null);
    const startedAt = new Date().toISOString();
    setUploadSession({
      fileUuid: null,
      fileName: selectedFile.name,
      fileSizeBytes: selectedFile.size,
      strictMode,
      status: 'processing',
      stage: 'uploading',
      progress: 0,
      message: 'Enviando arquivo...',
      updatedAt: startedAt,
    });

    try {
      const response = await uploadService.uploadFile(
        selectedFile,
        strictMode,
        undefined,
        undefined,
        (progress) => {
          const safeProgress = Math.min(progress, 99);
          updateUploadSession({
            progress: safeProgress,
            stage: progress >= 100 ? 'server-processing' : 'uploading',
            message: progress >= 100 ? 'Upload concluido. Aguardando processamento do servidor...' : 'Enviando arquivo...',
            updatedAt: new Date().toISOString(),
          });
        }
      );

      updateUploadSession({
        fileUuid: response.file_uuid,
        status: response.status,
        stage: response.status === 'completed' ? 'completed' : response.status === 'inconsistent' ? 'inconsistent' : 'processing',
        progress: response.status === 'completed' || response.status === 'inconsistent' ? 100 : 95,
        message: response.message,
        updatedAt: new Date().toISOString(),
      });

      setSelectedFile(null);

      if (location.pathname === '/' || location.pathname.startsWith('/upload')) {
        navigate(`/dashboard?file=${encodeURIComponent(response.file_uuid)}`);
      }
    } catch (error) {
      const friendlyError = toFriendlyError(error);
      setErrorMessage(friendlyError);
      updateUploadSession({
        status: 'failed',
        stage: 'failed',
        progress: 100,
        message: friendlyError,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5" />
            Upload de Arquivo
          </CardTitle>
          <CardDescription>
            Arraste um arquivo CSV, TSV ou Excel. Tamanho maximo permitido: 500MB. O processamento continua ao trocar de aba.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            {...dropzone.getRootProps()}
            className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              isProcessing
                ? 'border-primary/30 bg-primary/5'
                : dropzone.isDragActive
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/40 hover:bg-accent/30'
            }`}
          >
            <input {...dropzone.getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              <p className="text-base font-medium">
                {dropzone.isDragActive
                  ? 'Solte o arquivo para selecionar'
                  : 'Arraste e solte aqui, ou clique para escolher'}
              </p>
              <p className="text-sm text-muted-foreground">
                Formatos: {SUPPORTED_EXTENSIONS.join(', ')}
              </p>
              {isProcessing && (
                <p className="text-xs text-muted-foreground">
                  Existe um arquivo em processamento. O estado vai continuar sendo atualizado.
                </p>
              )}
            </div>
          </div>

          {selectedFile && (
            <div className="rounded-lg border bg-card/70 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="info">Selecionado</Badge>
                <span className="font-medium">{selectedFile.name}</span>
                <Badge variant="secondary">{formatBytes(selectedFile.size)}</Badge>
                <Badge variant="outline">{fileExtension || 'sem-extensao'}</Badge>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
            <label className="inline-flex items-center gap-2 text-sm font-medium" htmlFor="strict-mode">
              <input
                id="strict-mode"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={strictMode}
                onChange={(event) => setStrictMode(event.target.checked)}
                disabled={isProcessing}
              />
              Modo estrito
            </label>
            <span className="text-sm text-muted-foreground">
              Se ativado, inconsistencias de estrutura sao registradas, mas o dashboard continua sendo gerado.
            </span>
          </div>

          {uploadSession && uploadSession.status !== 'idle' && (
            <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card/80 p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex items-center gap-2 font-medium">
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}
                  {visibleMessage}
                </span>
                <Badge variant={uploadSession.status === 'failed' ? 'destructive' : uploadSession.status === 'inconsistent' ? 'warning' : 'secondary'}>
                  {uploadSession.status}
                </Badge>
              </div>
              <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{uploadSession.fileName}</span>
                <span className="tabular-nums">{visibleProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="relative h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.max(visibleProgress, 8)}%` }}
                >
                  <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_18%,rgba(255,255,255,0.35)_35%,transparent_52%)] bg-[length:200%_100%]" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">Etapa atual: {visibleStage}</div>
              {uploadSession.status === 'inconsistent' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {inconsistentMetadataQuery.data ? (
                    <InconsistencyDetails report={inconsistentMetadataQuery.data.integrity_report} buttonLabel="Mostrar pontos de inconsistencia" />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (uploadSession.fileUuid) {
                          navigate(`/dashboard?file=${encodeURIComponent(uploadSession.fileUuid)}`);
                        }
                      }}
                    >
                      Ver inconsistencias no dashboard
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedFile(null);
                setErrorMessage(null);
                setStrictMode(false);
                if (!isProcessing) {
                  clearUploadSession();
                }
              }}
              disabled={isProcessing}
            >
              Limpar
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  Enviar Arquivo
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
