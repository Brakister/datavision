"""Endpoints de metadados e schema."""
import uuid
from pathlib import Path

import duckdb
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ValidationException
from app.db.database import get_db
from app.models import FileUpload
from app.schemas import ColumnSchema, FileMetadataResponse, IntegrityReport, SheetMetadata
from app.services.local_store import load_record

router = APIRouter(prefix="/files", tags=["Files"])
settings = get_settings()


def _sanitize_identifier(name: str) -> str:
    return ''.join(char if char.isalnum() else '_' for char in name)


def _to_table_name(sheet_name: str) -> str:
    return f"sheet_{_sanitize_identifier(sheet_name)}"[:60]


def _map_duckdb_type(duckdb_type: str) -> str:
    dtype = duckdb_type.upper()
    if "VARCHAR" in dtype or "TEXT" in dtype or "CHAR" in dtype:
        return "string"
    if "INTEGER" in dtype or "BIGINT" in dtype or "SMALLINT" in dtype or "TINYINT" in dtype:
        return "integer"
    if "DECIMAL" in dtype or "NUMERIC" in dtype:
        return "decimal"
    if "DOUBLE" in dtype or "FLOAT" in dtype or "REAL" in dtype:
        return "float"
    if "BOOLEAN" in dtype:
        return "boolean"
    if "TIMESTAMP" in dtype or "DATETIME" in dtype:
        return "datetime"
    if "DATE" in dtype:
        return "date"
    return "mixed"


def _get_file_storage_dir(file_record: FileUpload) -> Path:
    storage_path = file_record.metadata_json.get("storage_path")
    if storage_path:
        return Path(storage_path).parent
    return Path(settings.STORAGE_PATH) / str(file_record.id)

def _get_storage_dir_from_local(file_uuid: str, local_record: dict) -> Path:
    storage_path = (local_record.get("metadata_json") or {}).get("storage_path")
    if storage_path:
        return Path(storage_path).parent
    return Path(settings.STORAGE_PATH) / file_uuid


@router.get("/{file_uuid}/metadata", response_model=FileMetadataResponse)
async def get_file_metadata(file_uuid: str, db: AsyncSession | None = Depends(get_db)):
    """Retorna metadados completos do arquivo processado."""
    try:
        parsed_uuid = uuid.UUID(file_uuid)
    except ValueError as exc:
        raise ValidationException("UUID invalido", error_code="INVALID_UUID", status_code=400) from exc

    if db is not None:
        file_record = await db.get(FileUpload, parsed_uuid)
        if file_record is None:
            raise ValidationException("Arquivo nao encontrado", error_code="FILE_NOT_FOUND", status_code=404)
        storage_path = _get_file_storage_dir(file_record)
        original_filename = file_record.original_filename
        file_format = file_record.file_format
        file_size_bytes = file_record.file_size_bytes
        file_hash_sha256 = file_record.file_hash_sha256
        status = file_record.status
        metadata_json = file_record.metadata_json or {}
        created_at = file_record.created_at.isoformat()
    else:
        local = load_record(file_uuid)
        if local is None:
            raise ValidationException("Arquivo nao encontrado", error_code="FILE_NOT_FOUND", status_code=404)
        storage_path = _get_storage_dir_from_local(file_uuid, local)
        original_filename = local.get("original_filename", "unknown")
        file_format = local.get("file_format", "csv")
        file_size_bytes = int(local.get("file_size_bytes", 0))
        file_hash_sha256 = local.get("file_hash_sha256", "")
        status = local.get("status", "completed")
        metadata_json = local.get("metadata_json") or {}
        created_at = metadata_json.get("created_at") or ""

    db_path = storage_path / "analytics.db"
    if not db_path.exists():
        raise ValidationException(
            "Dados analiticos nao encontrados",
            error_code="ANALYTICS_NOT_FOUND",
            status_code=404,
        )

    conn = duckdb.connect(str(db_path), read_only=True)

    try:
        table_names = [row[0] for row in conn.execute("SHOW TABLES").fetchall()]
        sheets: list[SheetMetadata] = []
        total_rows = 0
        columns_by_type: dict[str, int] = {}
        mixed_type_columns: list[str] = []
        sheet_hashes: dict[str, str] = {}
        empty_cells = 0

        for sheet_index, table_name in enumerate(sorted(table_names)):
            row_count = conn.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()[0]
            schema_rows = conn.execute(f'DESCRIBE "{table_name}"').fetchall()
            table_rows = conn.execute(f'SELECT * FROM "{table_name}" LIMIT 200').fetchdf()

            total_rows += int(row_count)
            sheet_name = table_name.replace("sheet_", "", 1)
            columns: list[ColumnSchema] = []

            for idx, schema_row in enumerate(schema_rows):
                col_name = schema_row[0]
                col_type = schema_row[1]
                quoted_col = f'"{col_name}"'
                null_count = conn.execute(
                    f'SELECT COUNT(*) FROM "{table_name}" WHERE {quoted_col} IS NULL'
                ).fetchone()[0]
                unique_count = conn.execute(
                    f'SELECT COUNT(DISTINCT {quoted_col}) FROM "{table_name}"'
                ).fetchone()[0]
                sample_values_df = conn.execute(
                    f'SELECT {quoted_col} FROM "{table_name}" WHERE {quoted_col} IS NOT NULL LIMIT 10'
                ).fetchdf()
                sample_values = [str(value) for value in sample_values_df[col_name].tolist()]

                detected_type = _map_duckdb_type(str(col_type))
                columns_by_type[detected_type] = columns_by_type.get(detected_type, 0) + 1
                if detected_type == "mixed":
                    mixed_type_columns.append(f"{sheet_name}.{col_name}")

                empty_cells += int(null_count)
                columns.append(
                    ColumnSchema(
                        name=col_name,
                        index=idx,
                        detected_type=detected_type,
                        null_count=int(null_count),
                        unique_count=int(unique_count),
                        cardinality=int(unique_count),
                        sample_values=sample_values,
                    )
                )

            sheet_hash = str(abs(hash(str(table_rows.to_dict("records")))))
            sheet_hashes[sheet_name] = sheet_hash

            sheets.append(SheetMetadata(
                name=sheet_name,
                index=sheet_index,
                row_count=int(row_count),
                column_count=len(schema_rows),
                columns=columns,
                sheet_hash=sheet_hash,
            ))

        persisted_report = metadata_json.get("integrity_report", {})
        formulas_detected = int(persisted_report.get("formulas_detected", 0))
        merged_cells_detected = int(persisted_report.get("merged_cells_detected", 0))
        engine_divergences = persisted_report.get("engine_divergences", [])
        engines_used = persisted_report.get("engines_used", ["duckdb"])
        warnings = persisted_report.get("warnings", [])
        errors = persisted_report.get("errors", [])

        return FileMetadataResponse(
            uuid=file_uuid,
            original_filename=original_filename,
            file_format=file_format,
            file_size_bytes=file_size_bytes,
            file_hash_sha256=file_hash_sha256,
            status=status,
            strict_mode=bool(metadata_json.get("strict_mode", False)),
            total_sheets=len(sheets),
            total_rows=total_rows,
            total_columns=max((s.column_count for s in sheets), default=0),
            sheets=sheets,
            integrity_report=IntegrityReport(
                total_sheets=len(sheets),
                total_rows=total_rows,
                total_columns=max((s.column_count for s in sheets), default=0),
                cells_read=sum(s.row_count * s.column_count for s in sheets),
                empty_cells=empty_cells,
                columns_by_type=columns_by_type,
                mixed_type_columns=mixed_type_columns,
                formulas_detected=formulas_detected,
                merged_cells_detected=merged_cells_detected,
                file_hash=file_hash_sha256,
                file_hash_sha256=file_hash_sha256,
                sheet_hashes=sheet_hashes,
                engines_used=engines_used,
                engine_divergences=engine_divergences,
                warnings=warnings,
                errors=errors,
                strict_mode_blocked=bool(persisted_report.get("strict_mode_blocked", False)),
            ),
            created_at=created_at,
        )
    finally:
        conn.close()


@router.get("/{file_uuid}/sheets/{sheet_name}/schema")
async def get_sheet_schema(file_uuid: str, sheet_name: str, db: AsyncSession | None = Depends(get_db)):
    """Retorna schema detectado de uma aba especifica."""
    try:
        parsed_uuid = uuid.UUID(file_uuid)
    except ValueError as exc:
        raise ValidationException("UUID invalido", error_code="INVALID_UUID", status_code=400) from exc

    if db is not None:
        file_record = await db.get(FileUpload, parsed_uuid)
        if file_record is None:
            raise ValidationException("Arquivo nao encontrado", error_code="FILE_NOT_FOUND", status_code=404)
        storage_path = _get_file_storage_dir(file_record)
    else:
        local = load_record(file_uuid)
        if local is None:
            raise ValidationException("Arquivo nao encontrado", error_code="FILE_NOT_FOUND", status_code=404)
        storage_path = _get_storage_dir_from_local(file_uuid, local)

    db_path = storage_path / "analytics.db"
    if not db_path.exists():
        raise ValidationException("Dados nao encontrados", error_code="ANALYTICS_NOT_FOUND", status_code=404)

    conn = duckdb.connect(str(db_path), read_only=True)
    try:
        table_name = _to_table_name(sheet_name)
        available_tables = {row[0] for row in conn.execute("SHOW TABLES").fetchall()}
        if table_name not in available_tables:
            raise ValidationException("Aba nao encontrada", error_code="SHEET_NOT_FOUND", status_code=404)

        schema_rows = conn.execute(f'DESCRIBE "{table_name}"').fetchall()
        columns: list[dict] = []

        for schema_row in schema_rows:
            col_name = schema_row[0]
            col_type = schema_row[1]
            quoted_col = f'"{col_name}"'

            null_count = conn.execute(
                f'SELECT COUNT(*) FROM "{table_name}" WHERE {quoted_col} IS NULL'
            ).fetchone()[0]
            unique_count = conn.execute(
                f'SELECT COUNT(DISTINCT {quoted_col}) FROM "{table_name}"'
            ).fetchone()[0]
            min_max = conn.execute(
                f'SELECT MIN({quoted_col}), MAX({quoted_col}) FROM "{table_name}"'
            ).fetchone()
            samples_df = conn.execute(
                f'SELECT {quoted_col} FROM "{table_name}" WHERE {quoted_col} IS NOT NULL LIMIT 10'
            ).fetchdf()

            columns.append(
                {
                    "name": col_name,
                    "type": _map_duckdb_type(str(col_type)),
                    "duckdb_type": str(col_type),
                    "null_count": int(null_count),
                    "unique_count": int(unique_count),
                    "cardinality": int(unique_count),
                    "min": None if min_max[0] is None else str(min_max[0]),
                    "max": None if min_max[1] is None else str(min_max[1]),
                    "sample_values": [str(value) for value in samples_df[col_name].tolist()],
                }
            )

        return {
            "file_uuid": file_uuid,
            "sheet": sheet_name,
            "columns": columns,
        }
    finally:
        conn.close()
