"""Endpoints de metadados e schema."""
from fastapi import APIRouter, HTTPException
from pathlib import Path
import duckdb

from app.core.config import get_settings
from app.schemas import FileMetadataResponse, IntegrityReport, SheetMetadata

router = APIRouter(prefix="/files", tags=["Files"])
settings = get_settings()


@router.get("/{file_uuid}/metadata", response_model=FileMetadataResponse)
async def get_file_metadata(file_uuid: str):
    """Retorna metadados completos do arquivo processado."""
    storage_path = Path(settings.STORAGE_PATH) / file_uuid

    if not storage_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado")

    # Em producao, buscar do PostgreSQL
    # Aqui, reconstruimos a partir do DuckDB
    db_path = storage_path / "analytics.db"

    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Dados analiticos nao encontrados")

    conn = duckdb.connect(str(db_path), read_only=True)

    try:
        # Listar tabelas (abas)
        tables = conn.execute("SHOW TABLES").fetchall()
        sheets = []
        total_rows = 0

        for table in tables:
            table_name = table[0]
            # Obter contagem
            count = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
            # Obter schema
            schema = conn.execute(f"DESCRIBE {table_name}").fetchdf()

            total_rows += count

            from app.schemas import ColumnSchema
            columns = []
            for idx, row in schema.iterrows():
                columns.append(ColumnSchema(
                    name=row["column_name"],
                    index=idx,
                    detected_type="string",  # Simplificado
                    null_count=0,
                    unique_count=0,
                    cardinality=0,
                ))

            sheets.append(SheetMetadata(
                name=table_name.replace("sheet_", ""),
                index=0,
                row_count=count,
                column_count=len(schema),
                columns=columns,
                sheet_hash="",
            ))

        return FileMetadataResponse(
            uuid=file_uuid,
            original_filename="arquivo.xlsx",  # Em producao, buscar do DB
            file_format="xlsx",
            file_size_bytes=0,
            file_hash_sha256=file_uuid,
            status="completed",
            strict_mode=False,
            total_sheets=len(sheets),
            total_rows=total_rows,
            total_columns=max((s.column_count for s in sheets), default=0),
            sheets=sheets,
            integrity_report=IntegrityReport(
                total_sheets=len(sheets),
                total_rows=total_rows,
                total_columns=max((s.column_count for s in sheets), default=0),
                cells_read=0,
                empty_cells=0,
                file_hash_sha256=file_uuid,
            ),
            created_at="2024-01-01T00:00:00",
        )
    finally:
        conn.close()


@router.get("/{file_uuid}/sheets/{sheet_name}/schema")
async def get_sheet_schema(file_uuid: str, sheet_name: str):
    """Retorna schema detectado de uma aba especifica."""
    storage_path = Path(settings.STORAGE_PATH) / file_uuid
    db_path = storage_path / "analytics.db"

    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Dados nao encontrados")

    conn = duckdb.connect(str(db_path), read_only=True)
    try:
        table_name = f"sheet_{sheet_name}".replace(" ", "_")[:60]
        schema = conn.execute(f"DESCRIBE {table_name}").fetchdf()
        return {"sheet": sheet_name, "columns": schema.to_dict("records")}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
    finally:
        conn.close()
