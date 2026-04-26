import axios from 'axios';
import type { AxiosProgressEvent } from 'axios';
import type {
  UploadResponse,
  ProcessingProgress,
  FileMetadata,
  ChartSuggestion,
  ChartData,
  ChartDataRequest,
  TableData,
  TableDataRequest,
  DashboardLayout,
  DashboardLayoutRequest,
  ExportRequest,
  ExportResponse,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Interceptors
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const uploadService = {
  uploadFile: async (
    file: File,
    strictMode: boolean = false,
    encoding?: string,
    delimiter?: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('strict_mode', String(strictMode));
    if (encoding) formData.append('encoding', encoding);
    if (delimiter) formData.append('delimiter', delimiter);

    const response = await api.post<UploadResponse>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 min para arquivos grandes
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (!onProgress || !event.total) return;
        const progress = Math.min(100, Math.round((event.loaded * 100) / event.total));
        onProgress(progress);
      },
    });
    return response.data;
  },

  getStatus: async (fileUuid: string) => {
    const response = await api.get(`/upload/${fileUuid}/status`);
    return response.data as ProcessingProgress;
  },
};

export const fileService = {
  getMetadata: async (fileUuid: string): Promise<FileMetadata> => {
    const response = await api.get<FileMetadata>(`/files/${fileUuid}/metadata`);
    return response.data;
  },

  getSheetSchema: async (fileUuid: string, sheetName: string) => {
    const response = await api.get(`/files/${fileUuid}/sheets/${sheetName}/schema`);
    return response.data;
  },
};

export const analyticsService = {
  getSuggestions: async (fileUuid: string, sheetName: string): Promise<ChartSuggestion[]> => {
    const response = await api.get<ChartSuggestion[]>(
      `/analytics/${fileUuid}/sheets/${sheetName}/suggestions`
    );
    return response.data;
  },

  getChartData: async (request: ChartDataRequest): Promise<ChartData> => {
    const response = await api.post<ChartData>('/analytics/chart-data', request);
    return response.data;
  },

  getTableData: async (request: TableDataRequest): Promise<TableData> => {
    const response = await api.post<TableData>('/analytics/table-data', request);
    return response.data;
  },
};

export const layoutService = {
  saveLayout: async (request: DashboardLayoutRequest): Promise<DashboardLayout> => {
    const response = await api.post<DashboardLayout>('/layouts', request);
    return response.data;
  },

  getLayouts: async (fileUuid: string): Promise<DashboardLayout[]> => {
    const response = await api.get<DashboardLayout[]>(`/layouts?file_uuid=${fileUuid}`);
    return response.data;
  },
};

export const exportService = {
  exportData: async (request: ExportRequest): Promise<ExportResponse> => {
    const response = await api.post<ExportResponse>('/export', request);
    return response.data;
  },
};

export default api;
