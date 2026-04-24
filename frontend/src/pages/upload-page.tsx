import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react';
import { AxiosError } from 'axios';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { uploadService } from '@/services';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      const file = files[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setSelectedFile(null);
        setErrorMessage('Arquivo maior que 500MB. Selecione um arquivo menor.');
        setSuccessMessage(null);
        return;
      }

      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!SUPPORTED_EXTENSIONS.includes(extension)) {
        setSelectedFile(null);
        setErrorMessage('Formato invalido. Envie CSV, TSV, XLSX, XLS, XLSM, XLSB ou ODS.');
        setSuccessMessage(null);
        return;
      }

      setSelectedFile(file);
      setErrorMessage(null);
      setSuccessMessage(null);
      setUploadProgress(0);
    },
    onDropRejected: () => {
      setSelectedFile(null);
      setSuccessMessage(null);
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
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setUploadProgress(0);

    try {
      const response = await uploadService.uploadFile(
        selectedFile,
        strictMode,
        undefined,
        undefined,
        (progress) => setUploadProgress(progress)
      );

      setUploadProgress(100);
      setSuccessMessage('Upload concluido com sucesso. Redirecionando...');
      navigate(`/dashboard?file=${encodeURIComponent(response.file_uuid)}`);
    } catch (error) {
      setErrorMessage(toFriendlyError(error));
    } finally {
      setIsUploading(false);
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
            Arraste um arquivo CSV, TSV ou Excel. Tamanho maximo permitido: 500MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            {...dropzone.getRootProps()}
            className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              dropzone.isDragActive
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
                disabled={isUploading}
              />
              Modo estrito
            </label>
            <span className="text-sm text-muted-foreground">
              Se ativado, inconsistencias de estrutura retornam erro.
            </span>
          </div>

          {isUploading && (
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando arquivo...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-500">
              <CheckCircle2 className="mt-0.5 h-4 w-4" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedFile(null);
                setErrorMessage(null);
                setSuccessMessage(null);
                setUploadProgress(0);
              }}
              disabled={isUploading}
            >
              Limpar
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando
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
