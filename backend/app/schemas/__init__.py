"""Schemas Pydantic para requests/responses da API DataVision."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


ColumnType = Literal[
	"string",
	"integer",
	"float",
	"decimal",
	"currency",
	"percentage",
	"boolean",
	"date",
	"datetime",
	"categorical",
	"mixed",
	"empty",
]

FileStatus = Literal["pending", "processing", "completed", "inconsistent", "failed"]


class ColumnSchema(BaseModel):
	name: str
	index: int
	detected_type: ColumnType
	null_count: int = 0
	unique_count: int = 0
	cardinality: int = 0
	sample_values: list[Any] = Field(default_factory=list)


class SheetMetadata(BaseModel):
	name: str
	index: int
	row_count: int
	column_count: int
	columns: list[ColumnSchema] = Field(default_factory=list)
	sheet_hash: str = ""


class IntegrityReport(BaseModel):
	total_sheets: int
	total_rows: int
	total_columns: int = 0
	cells_read: int = 0
	empty_cells: int = 0
	columns_by_type: dict[str, int] = Field(default_factory=dict)
	mixed_type_columns: list[str] = Field(default_factory=list)
	formulas_detected: int = 0
	merged_cells_detected: int = 0
	file_hash: str = ""
	file_hash_sha256: str
	sheet_hashes: dict[str, str] = Field(default_factory=dict)
	engines_used: list[str] = Field(default_factory=list)
	engine_divergences: list[dict[str, Any]] = Field(default_factory=list)
	warnings: list[str] = Field(default_factory=list)
	errors: list[str] = Field(default_factory=list)
	strict_mode_blocked: bool = False


class ProcessingProgress(BaseModel):
	status: FileStatus = "processing"
	progress: int = 0
	message: str = ""


class UploadResponse(BaseModel):
	file_uuid: str
	original_filename: str
	file_size_bytes: int
	status: FileStatus
	message: str
	strict_mode: bool = False


class FileMetadataResponse(BaseModel):
	uuid: str
	original_filename: str
	file_format: str
	file_size_bytes: int
	file_hash_sha256: str
	status: FileStatus
	strict_mode: bool
	total_sheets: int
	total_rows: int
	total_columns: int
	sheets: list[SheetMetadata] = Field(default_factory=list)
	integrity_report: IntegrityReport
	created_at: str


class ChartSuggestion(BaseModel):
	chart_type: str
	title: str
	description: str
	dimension_columns: list[str] = Field(default_factory=list)
	metric_columns: list[str] = Field(default_factory=list)
	confidence_score: float
	heuristic_rule: str
	recommended_aggregation: str = "sum"


class ChartDataRequest(BaseModel):
	file_uuid: str
	sheet_name: str
	chart_type: str
	dimension_columns: list[str] = Field(default_factory=list)
	metric_columns: list[str] = Field(default_factory=list)
	aggregation: str = "sum"
	filters: Optional[dict[str, Any]] = None
	limit: int = 1000


class ChartDataResponse(BaseModel):
	chart_type: str
	dimensions: list[str] = Field(default_factory=list)
	metrics: list[str] = Field(default_factory=list)
	data: list[dict[str, Any]] = Field(default_factory=list)
	total_rows: int
	applied_filters: dict[str, Any] = Field(default_factory=dict)
	generated_at: str


class TableFilter(BaseModel):
	column: str
	operator: str
	value: Any = None
	value_to: Any = None


class TableDataRequest(BaseModel):
	file_uuid: str
	sheet_name: str
	page: int = 1
	page_size: int = 100
	sort_by: Optional[str] = None
	sort_direction: str = "asc"
	filters: list[TableFilter] = Field(default_factory=list)
	visible_columns: Optional[list[str]] = None


class TableDataResponse(BaseModel):
	data: list[dict[str, Any]] = Field(default_factory=list)
	page: int
	page_size: int
	total_rows: int
	total_pages: int
	applied_filters: list[dict[str, Any]] = Field(default_factory=list)
