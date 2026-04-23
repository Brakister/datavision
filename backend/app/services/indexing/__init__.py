"""Servico de indexacao para busca e filtro rapido."""
from pathlib import Path
from typing import Any

import duckdb

from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()


class IndexingService:
    """Cria e gerencia indices para consultas rapidas."""

    def __init__(self):
        self.storage_path = Path(settings.STORAGE_PATH)

    def create_indexes(self, file_uuid: str, sheet_name: str, columns: list[str]) -> list[str]:
        """Cria indices nas colunas especificadas."""
        db_path = self.storage_path / file_uuid / "analytics.db"
        conn = duckdb.connect(str(db_path))
        table_name = self._sanitize_table_name(sheet_name)

        created = []
        for col in columns:
            idx_name = f"idx_{table_name}_{self._sanitize_name(col)}"
            try:
                conn.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table_name}(\"{col}\")")
                created.append(idx_name)
            except Exception as e:
                logger.warning(f"Falha ao criar indice {idx_name}: {e}")

        conn.close()
        return created

    def get_column_stats(self, file_uuid: str, sheet_name: str, column: str) -> dict[str, Any]:
        """Retorna estatisticas de uma coluna."""
        db_path = self.storage_path / file_uuid / "analytics.db"
        conn = duckdb.connect(str(db_path), read_only=True)
        table_name = self._sanitize_table_name(sheet_name)

        try:
            sql = f"SELECT COUNT(*) as total, COUNT(DISTINCT \"{column}\") as unique_count, COUNT(\"{column}\") - COUNT(DISTINCT \"{column}\") as null_count, MIN(\"{column}\") as min_val, MAX(\"{column}\") as max_val FROM {table_name}"
            stats = conn.execute(sql).fetchone()

            return {
                "column": column,
                "total": stats[0],
                "unique_count": stats[1],
                "null_count": stats[2],
                "min": stats[3],
                "max": stats[4],
            }
        finally:
            conn.close()

    def get_unique_values(self, file_uuid: str, sheet_name: str, column: str, limit: int = 100) -> list[Any]:
        """Retorna valores unicos de uma coluna."""
        db_path = self.storage_path / file_uuid / "analytics.db"
        conn = duckdb.connect(str(db_path), read_only=True)
        table_name = self._sanitize_table_name(sheet_name)

        try:
            sql = f"SELECT DISTINCT \"{column}\" FROM {table_name} WHERE \"{column}\" IS NOT NULL LIMIT {limit}"
            result = conn.execute(sql).fetchall()
            return [r[0] for r in result]
        finally:
            conn.close()

    def _sanitize_table_name(self, name: str) -> str:
        sanitized = "".join(c if c.isalnum() else "_" for c in name)
        return f"sheet_{sanitized}"[:60]

    def _sanitize_name(self, name: str) -> str:
        return "".join(c if c.isalnum() else "_" for c in name)[:40]


indexing_service = IndexingService()
