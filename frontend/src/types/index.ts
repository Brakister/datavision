export type ColumnType =
  | 'string'
  | 'integer'
  | 'float'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'percentage'
  | 'currency'
  | 'categorical'
  | 'mixed'
  | 'empty';

export type FileStatus = 'pending' | 'processing' | 'completed' | 'error' | 'inconsistent' | 'failed';

export type FileFormat = 'xlsx' | 'xls' | 'xlsm' | 'xlsb' | 'csv' | 'tsv' | 'ods';

export type ChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'composed'
  | 'radar'
  | 'treemap'
  | 'funnel'
  | 'radial_bar'
  | 'kpi';

export interface ColumnSchema {
  name: string;
  index: number;
  detected_type: ColumnType;
  null_count: number;
  unique_count: number;
  cardinality: number;
  min_value: unknown;
  max_value: unknown;
  sample_values: unknown[];
  has_leading_zeros: boolean;
  has_formulas: boolean;
  has_merged_cells: boolean;
  format_pattern: string | null;
}

export interface SheetMetadata {
  name: string;
  index: number;
  row_count: number;
  column_count: number;
  columns: ColumnSchema[];
  has_headers: boolean;
  header_row: number;
  data_start_row: number;
  sheet_hash: string;
}

export interface IntegrityReport {
  total_sheets: number;
  total_rows: number;
  total_columns: number;
  cells_read: number;
  empty_cells: number;
  columns_by_type: Record<string, number>;
  mixed_type_columns: string[];
  formulas_detected: number;
  merged_cells_detected: number;
  file_hash_sha256: string;
  sheet_hashes: Record<string, string>;
  engines_used: string[];
  engine_divergences: Array<{
    type: string;
    sheet?: string;
    primary_rows?: number;
    secondary_rows?: number;
    severity: string;
  }>;
  warnings: string[];
  errors: string[];
  strict_mode_blocked: boolean;
}

export interface FileMetadata {
  uuid: string;
  original_filename: string;
  file_format: FileFormat;
  file_size_bytes: number;
  file_hash_sha256: string;
  status: FileStatus;
  strict_mode: boolean;
  total_sheets: number;
  total_rows: number;
  total_columns: number;
  sheets: SheetMetadata[];
  integrity_report: IntegrityReport;
  created_at: string;
  processed_at: string | null;
}

export interface ChartSuggestion {
  chart_type: ChartType;
  title: string;
  description: string;
  dimension_columns: string[];
  metric_columns: string[];
  confidence_score: number;
  heuristic_rule: string;
  recommended_aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct';
}

export interface ChartData {
  chart_type: string;
  dimensions: string[];
  metrics: string[];
  data: Array<Record<string, unknown>>;
  total_rows: number;
  applied_filters: Record<string, unknown>;
  generated_at: string;
}

export interface ChartDataRequest {
  file_uuid: string;
  sheet_name: string;
  chart_type: ChartType;
  dimension_columns: string[];
  metric_columns: string[];
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct';
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface FilterOperator {
  column: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'greater_than'
    | 'less_than'
    | 'between'
    | 'in'
    | 'not_in'
    | 'is_null'
    | 'is_not_null'
    | 'top_n'
    | 'bottom_n';
  value: unknown;
  value_to?: unknown;
}

export interface FilterPreset {
  name: string;
  filters: FilterOperator[];
  affected_rows?: number;
  created_at: string;
}

export interface TableData {
  data: Array<Record<string, unknown>>;
  page: number;
  page_size: number;
  total_rows: number;
  total_pages: number;
  columns: ColumnSchema[];
  applied_filters: FilterOperator[];
  execution_time_ms: number;
}

export interface TableDataRequest {
  file_uuid: string;
  sheet_name: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
  filters?: FilterOperator[];
  visible_columns?: string[];
}

export interface WidgetLayout {
  id: string;
  type: 'chart' | 'table' | 'kpi' | 'filter';
  chart_type?: ChartType;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: Record<string, unknown>;
}

export interface DashboardLayout {
  id: number;
  file_uuid: string;
  name: string;
  layout_config: WidgetLayout[];
  filter_preset: FilterPreset | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardLayoutRequest {
  file_uuid: string;
  name: string;
  layout_config: WidgetLayout[];
  filter_preset?: FilterPreset | null;
}

export interface ExportRequest {
  file_uuid: string;
  sheet_name: string;
  format: 'csv' | 'xlsx' | 'json' | 'parquet';
  filters?: FilterOperator[];
  columns?: string[];
}

export interface ExportResponse {
  download_url?: string;
  filename?: string;
  expires_at?: string;
  status?: string;
  message?: string;
}

export interface ProcessingProgress {
  file_uuid: string;
  status: FileStatus;
  stage: string;
  progress: number;
  message: string;
  current_sheet?: string | null;
  sheets_processed?: number;
  total_sheets?: number;
  rows_processed?: number;
  total_rows?: number;
  started_at?: string;
  estimated_completion?: string | null;
  error?: string | null;
}

export interface UploadResponse {
  file_uuid: string;
  original_filename: string;
  file_size_bytes: number;
  status: FileStatus;
  message: string;
  strict_mode: boolean;
}
