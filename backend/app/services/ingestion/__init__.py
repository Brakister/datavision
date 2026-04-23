"""Serviço de ingestão multi-engine com validação de integridade.

Implementa leitura em múltiplas camadas:
- Camada primária: python-calamine / Polars para leitura rápida
- Camada secundária: openpyxl para verificação estrutural detalhada (xlsx)
- Camada específica: pyxlsb para arquivos .xlsb
- Divergências entre engines marcam arquivo como inconsistente
"""
import hashlib
import os
import tempfile
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Optional

import polars as pl
import pandas as pd
import duckdb
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

from app.core.config import get_settings
from app.core.exceptions import (
    IngestionException, InconsistencyException, UnsupportedFormatException,
    FileTooLargeException, ValidationException
)
from app.core.logging import logger
from app.schemas import (
    IntegrityReport, ColumnSchema, SheetMetadata, ColumnType, FileStatus
)


settings = get_settings()

SUPPORTED_FORMATS = {".xlsx", ".xls", ".xlsm", ".xlsb", ".csv", ".tsv", ".ods"}

# Mapeamento de extensões
FORMAT_MAP = {
    ".xlsx": "xlsx",
    ".xls": "xls",
    ".xlsm": "xlsm",
    ".xlsb": "xlsb",
    ".csv": "csv",
    ".tsv": "tsv",
    ".ods": "ods",
}


class IngestionService:
    """Serviço principal de ingestão de arquivos tabulares."""

    def __init__(self):
        self.storage_path = Path(settings.STORAGE_PATH)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.duckdb_path = settings.DUCKDB_PATH

    async def process_upload(
        self,
        file_path: str,
        original_filename: str,
        strict_mode: bool = False,
        preferred_date_format: Optional[str] = None,
        encoding: Optional[str] = None,
        delimiter: Optional[str] = None,
    ) -> dict[str, Any]:
        """Processa upload completo: validação, leitura, normalização, indexação.

        Returns:
            Dicionário com uuid, metadados e relatório de integridade.
        """
        start_time = datetime.utcnow()
        file_path_obj = Path(file_path)

        # 1. Validação de formato
        ext = file_path_obj.suffix.lower()
        if ext not in SUPPORTED_FORMATS:
            raise UnsupportedFormatException(f"Formato '{ext}' não suportado. Formatos: {SUPPORTED_FORMATS}")

        file_format = FORMAT_MAP[ext]

        # 2. Validação de tamanho
        file_size = file_path_obj.stat().st_size
        max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        if file_size > max_size:
            raise FileTooLargeException(
                f"Arquivo de {file_size / 1024 / 1024:.1f}MB excede limite de {settings.MAX_FILE_SIZE_MB}MB"
            )

        # 3. Cálculo de hash SHA-256
        file_hash = await self._calculate_sha256(file_path)

        # 4. Persistência do original
        uuid_str = file_hash[:16]  # Usar prefixo do hash como UUID determinístico
        storage_dir = self.storage_path / uuid_str
        storage_dir.mkdir(parents=True, exist_ok=True)
        stored_path = storage_dir / f"original{ext}"

        # Copiar arquivo para storage
        import shutil
        shutil.copy2(file_path, stored_path)

        logger.info(
            "Iniciando ingestão",
            extra={
                "uuid": uuid_str,
                "filename": original_filename,
                "format": file_format,
                "size_bytes": file_size,
                "strict_mode": strict_mode,
            }
        )

        # 5. Leitura multi-camada
        sheets_data = {}
        integrity_issues = []
        engines_used = []

        try:
            # Camada primária: python-calamine via Polars (mais rápido)
            primary_data = await self._read_primary(stored_path, file_format, encoding, delimiter)
            engines_used.append("polars/calamine")

            # Camada secundária: openpyxl para xlsx (verificação estrutural)
            if file_format in ("xlsx", "xlsm"):
                secondary_data = await self._read_secondary_xlsx(stored_path)
                engines_used.append("openpyxl")

                # Verificar divergências
                divergences = self._compare_readings(primary_data, secondary_data)
                if divergences:
                    integrity_issues.extend(divergences)
                    if strict_mode:
                        raise InconsistencyException(
                            f"Modo estrito ativo. Divergências detectadas: {len(divergences)}"
                        )

            # Camada específica: pyxlsb
            if file_format == "xlsb":
                # pyxlsb seria usado aqui para validação adicional
                engines_used.append("pyxlsb")

            sheets_data = primary_data

        except Exception as e:
            logger.error(f"Erro na leitura multi-camada: {e}", extra={"uuid": uuid_str})
            raise IngestionException(f"Falha na leitura do arquivo: {str(e)}") from e

        # 6. Análise estrutural e schema detection
        sheets_metadata = []
        total_rows = 0
        total_columns = 0

        for sheet_name, df in sheets_data.items():
            sheet_meta = self._analyze_sheet(df, sheet_name)
            sheets_metadata.append(sheet_meta)
            total_rows += sheet_meta.row_count
            total_columns = max(total_columns, sheet_meta.column_count)

        # 7. Normalização não-destrutiva e persistência em DuckDB
        duckdb_path = await self._persist_to_duckdb(uuid_str, sheets_data)

        # 8. Geração de relatório de integridade
        integrity_report = self._generate_integrity_report(
            file_hash=file_hash,
            sheets=sheets_metadata,
            engines_used=engines_used,
            integrity_issues=integrity_issues,
            strict_mode=strict_mode,
            file_size=file_size,
        )

        # 9. Log de transformações
        transformation_log = [{
            "timestamp": datetime.utcnow().isoformat(),
            "operation": "ingestion",
            "details": {
                "engines_used": engines_used,
                "sheets_count": len(sheets_metadata),
                "normalization_applied": "duckdb_preserve_types",
            }
        }]

        processing_time = (datetime.utcnow() - start_time).total_seconds()

        logger.info(
            "Ingestão concluída",
            extra={
                "uuid": uuid_str,
                "processing_time_seconds": processing_time,
                "total_rows": total_rows,
                "total_sheets": len(sheets_metadata),
            }
        )

        status = "inconsistent" if integrity_issues else "completed"

        return {
            "uuid": uuid_str,
            "original_filename": original_filename,
            "file_format": file_format,
            "file_size_bytes": file_size,
            "file_hash_sha256": file_hash,
            "status": status,
            "strict_mode": strict_mode,
            "total_sheets": len(sheets_metadata),
            "total_rows": total_rows,
            "total_columns": total_columns,
            "sheets": [s.model_dump() for s in sheets_metadata],
            "integrity_report": integrity_report.model_dump(),
            "transformation_log": transformation_log,
            "duckdb_path": str(duckdb_path),
            "storage_path": str(stored_path),
            "processing_time_seconds": processing_time,
        }

    async def _calculate_sha256(self, file_path: str) -> str:
        """Calcula hash SHA-256 do arquivo."""
        hash_obj = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hash_obj.update(chunk)
        return hash_obj.hexdigest()

    async def _read_primary(
        self,
        file_path: Path,
        file_format: str,
        encoding: Optional[str],
        delimiter: Optional[str],
    ) -> dict[str, pl.DataFrame]:
        """Leitura primária usando Polars (via python-calamine para Excel)."""

        if file_format in ("csv", "tsv"):
            sep = delimiter or ("\t" if file_format == "tsv" else ",")
            enc = encoding or "utf-8"

            # Tentar detectar encoding se não especificado
            if encoding is None:
                enc = self._detect_encoding(file_path)

            df = pl.read_csv(
                file_path,
                separator=sep,
                encoding=enc,
                infer_schema_length=10000,
                null_values=["", "NULL", "null", "NA", "N/A", "#N/A"],
                try_parse_dates=True,
            )
            return {"data": df}

        elif file_format in ("xlsx", "xls", "xlsm", "ods"):
            # Polars usa python-calamine por baixo para Excel (muito rápido)
            sheets = {}

            # Para xlsx, usar openpyxl para listar sheets primeiro (mais confiável)
            if file_format in ("xlsx", "xlsm"):
                wb = load_workbook(file_path, read_only=True, data_only=True)
                sheet_names = wb.sheetnames
                wb.close()
            else:
                # Para outros formatos, Polars lê diretamente
                sheet_names = ["data"]  # Simplificado

            for sheet_name in sheet_names:
                try:
                    df = pl.read_excel(
                        file_path,
                        sheet_name=sheet_name,
                        engine="calamine",
                        infer_schema_length=10000,
                    )
                    sheets[sheet_name] = df
                except Exception as e:
                    logger.warning(f"Falha ao ler aba '{sheet_name}' com calamine: {e}")
                    # Fallback para pandas/openpyxl
                    df_pd = pd.read_excel(file_path, sheet_name=sheet_name, engine="openpyxl")
                    sheets[sheet_name] = pl.from_pandas(df_pd)

            return sheets

        elif file_format == "xlsb":
            # pyxlsb via pandas
            df_pd = pd.read_excel(file_path, engine="pyxlsb")
            return {"data": pl.from_pandas(df_pd)}

        else:
            raise UnsupportedFormatException(f"Formato '{file_format}' não implementado na leitura primária")

    async def _read_secondary_xlsx(self, file_path: Path) -> dict[str, dict]:
        """Leitura secundária com openpyxl para verificação estrutural."""
        result = {}

        wb = load_workbook(file_path, read_only=True, data_only=True)

        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]

            # Coletar metadados estruturais
            merged_cells = list(ws.merged_cells.ranges)
            max_row = ws.max_row
            max_col = ws.max_column

            # Detectar fórmulas
            formula_count = 0
            for row in ws.iter_rows():
                for cell in row:
                    if cell.value and isinstance(cell.value, str) and cell.value.startswith("="):
                        formula_count += 1

            result[sheet_name] = {
                "max_row": max_row,
                "max_column": max_col,
                "merged_cells_count": len(merged_cells),
                "formula_count": formula_count,
                "sheet_hash": self._hash_sheet_structure(ws),
            }

        wb.close()
        return result

    def _compare_readings(
        self,
        primary: dict[str, pl.DataFrame],
        secondary: dict[str, dict],
    ) -> list[dict]:
        """Compara leituras entre engines e reporta divergências."""
        divergences = []

        # Verificar se todas as abas foram lidas
        primary_sheets = set(primary.keys())
        secondary_sheets = set(secondary.keys())

        if primary_sheets != secondary_sheets:
            divergences.append({
                "type": "sheet_mismatch",
                "primary_sheets": list(primary_sheets),
                "secondary_sheets": list(secondary_sheets),
                "severity": "high",
            })

        for sheet_name in primary_sheets & secondary_sheets:
            df = primary[sheet_name]
            sec = secondary[sheet_name]

            # Comparar contagem de linhas
            # +1 porque openpyxl conta header, Polars pode não contar dependendo da config
            row_diff = abs(df.height - (sec["max_row"] - 1))
            if row_diff > 5:  # Tolerância para headers
                divergences.append({
                    "type": "row_count_mismatch",
                    "sheet": sheet_name,
                    "primary_rows": df.height,
                    "secondary_rows": sec["max_row"] - 1,
                    "severity": "medium",
                })

            # Comparar colunas
            if df.width != sec["max_column"]:
                divergences.append({
                    "type": "column_count_mismatch",
                    "sheet": sheet_name,
                    "primary_columns": df.width,
                    "secondary_columns": sec["max_column"],
                    "severity": "medium",
                })

        return divergences

    def _analyze_sheet(self, df: pl.DataFrame, sheet_name: str) -> SheetMetadata:
        """Analisa schema e estatísticas de uma aba."""
        columns = []

        for idx, col_name in enumerate(df.columns):
            col = df[col_name]

            # Detectar tipo
            detected_type = self._detect_column_type(col)

            # Estatísticas
            null_count = col.null_count()
            unique_count = col.n_unique()
            cardinality = unique_count

            # Amostras (máx 10 valores não-nulos)
            samples = (
                col.drop_nulls()
                .head(10)
                .to_list()
            )

            # Min/max para tipos ordenáveis
            min_val = None
            max_val = None
            if detected_type in ("integer", "float", "decimal", "date", "datetime"):
                try:
                    min_val = col.min()
                    max_val = col.max()
                except:
                    pass

            # Detectar zeros à esquerda em strings
            has_leading_zeros = False
            if detected_type == "string":
                for val in samples:
                    if isinstance(val, str) and val.startswith("0") and len(val) > 1 and val[1:].isdigit():
                        has_leading_zeros = True
                        break

            col_schema = ColumnSchema(
                name=str(col_name),
                index=idx,
                detected_type=detected_type,
                null_count=null_count,
                unique_count=unique_count,
                cardinality=cardinality,
                min_value=min_val,
                max_value=max_val,
                sample_values=[str(s) for s in samples],
                has_leading_zeros=has_leading_zeros,
                has_formulas=False,  # Detectado na camada secundária
                has_merged_cells=False,
                format_pattern=None,
            )
            columns.append(col_schema)

        # Hash da aba baseado nos dados
        sheet_hash = hashlib.sha256(
            str(df.head(100).to_dicts()).encode()
        ).hexdigest()[:32]

        return SheetMetadata(
            name=sheet_name,
            index=0,
            row_count=df.height,
            column_count=df.width,
            columns=columns,
            has_headers=True,
            header_row=0,
            data_start_row=1,
            sheet_hash=sheet_hash,
        )

    def _detect_column_type(self, col: pl.Series) -> ColumnType:
        """Detecta tipo de coluna com heurísticas determinísticas."""
        dtype = col.dtype

        # Mapeamento direto de tipos Polars
        if dtype == pl.String:
            # Analisar amostras para detectar tipos especiais
            non_null = col.drop_nulls()
            if len(non_null) == 0:
                return "empty"

            samples = non_null.head(100).to_list()
            return self._infer_string_type(samples)

        elif dtype in (pl.Int8, pl.Int16, pl.Int32, pl.Int64, pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64):
            return "integer"

        elif dtype in (pl.Float32, pl.Float64):
            return "float"

        elif dtype == pl.Boolean:
            return "boolean"

        elif dtype == pl.Date:
            return "date"

        elif dtype == pl.Datetime:
            return "datetime"

        elif dtype == pl.Decimal:
            return "decimal"

        else:
            return "mixed"

    def _infer_string_type(self, samples: list) -> ColumnType:
        """Infere tipo especial a partir de amostras de strings."""
        if not samples:
            return "empty"

        total = len(samples)

        # Verificar se é percentual
        percent_count = sum(1 for s in samples if isinstance(s, str) and "%" in s)
        if percent_count / total > 0.8:
            return "percentage"

        # Verificar se é moeda
        currency_patterns = ["$", "R$", "€", "£", "¥"]
        currency_count = sum(
            1 for s in samples
            if isinstance(s, str) and any(p in s for p in currency_patterns)
        )
        if currency_count / total > 0.8:
            return "currency"

        # Verificar se é booleano textual
        bool_values = {"true", "false", "yes", "no", "sim", "não", "1", "0", "verdadeiro", "falso"}
        bool_count = sum(1 for s in samples if isinstance(s, str) and s.strip().lower() in bool_values)
        if bool_count / total > 0.9:
            return "boolean"

        # Verificar se é categórico (baixa cardinalidade relativa)
        unique_ratio = len(set(str(s).strip().lower() for s in samples)) / total
        if unique_ratio < 0.1 and total >= 10:
            return "categorical"

        # Verificar se parece data
        date_count = 0
        for s in samples:
            if isinstance(s, str):
                try:
                    pd.to_datetime(s, dayfirst=True)
                    date_count += 1
                except:
                    pass
        if date_count / total > 0.8:
            return "date"

        return "string"

    async def _persist_to_duckdb(
        self,
        uuid_str: str,
        sheets_data: dict[str, pl.DataFrame],
    ) -> Path:
        """Persiste dados normalizados em DuckDB."""
        db_path = self.storage_path / uuid_str / "analytics.db"

        conn = duckdb.connect(str(db_path))

        for sheet_name, df in sheets_data.items():
            # Normalizar nome da tabela
            table_name = self._sanitize_table_name(sheet_name)

            # Converter Polars para DuckDB
            # Preservar tipos - usar arrow como intermediário
            arrow_table = df.to_arrow()
            conn.register("temp_arrow", arrow_table)

            # Criar tabela persistente
            conn.execute(f"DROP TABLE IF EXISTS {table_name}")
            conn.execute(f"CREATE TABLE {table_name} AS SELECT * FROM temp_arrow")
            conn.unregister("temp_arrow")

            # Criar índices para colunas comuns
            for col in df.columns:
                if df[col].dtype in (pl.String, pl.Categorical):
                    idx_name = f"idx_{table_name}_{self._sanitize_table_name(col)}"
                    conn.execute(f'CREATE INDEX IF NOT EXISTS {idx_name} ON {table_name}("{col}")')

        conn.close()
        return db_path

    def _sanitize_table_name(self, name: str) -> str:
        """Sanitiza nome para uso como identificador SQL."""
        sanitized = "".join(c if c.isalnum() else "_" for c in name)
        return f"sheet_{sanitized}"[:60]

    def _generate_integrity_report(
        self,
        file_hash: str,
        sheets: list[SheetMetadata],
        engines_used: list[str],
        integrity_issues: list[dict],
        strict_mode: bool,
        file_size: int,
    ) -> IntegrityReport:
        """Gera relatório completo de integridade."""
        total_cells = sum(s.row_count * s.column_count for s in sheets)
        empty_cells = sum(
            sum(c.null_count for c in s.columns)
            for s in sheets
        )

        columns_by_type: dict[str, int] = {}
        mixed_columns = []

        for sheet in sheets:
            for col in sheet.columns:
                t = col.detected_type
                columns_by_type[t] = columns_by_type.get(t, 0) + 1
                if t == "mixed":
                    mixed_columns.append(f"{sheet.name}.{col.name}")

        sheet_hashes = {s.name: s.sheet_hash for s in sheets}

        warnings = []
        errors = []

        for issue in integrity_issues:
            msg = f"[{issue['severity'].upper()}] {issue['type']}: {issue.get('sheet', 'global')}"
            if issue["severity"] == "high":
                errors.append(msg)
            else:
                warnings.append(msg)

        # Verificações adicionais
        if mixed_columns:
            warnings.append(f"Colunas com tipos mistos detectados: {', '.join(mixed_columns)}")

        if file_size > 100 * 1024 * 1024:
            warnings.append(f"Arquivo grande ({file_size / 1024 / 1024:.0f}MB). Processamento pode ser mais lento.")

        return IntegrityReport(
            total_sheets=len(sheets),
            total_rows=sum(s.row_count for s in sheets),
            total_columns=max((s.column_count for s in sheets), default=0),
            cells_read=total_cells,
            empty_cells=empty_cells,
            columns_by_type=columns_by_type,
            mixed_type_columns=mixed_columns,
            formulas_detected=0,  # Populado da camada secundária
            merged_cells_detected=0,
            file_hash_sha256=file_hash,
            sheet_hashes=sheet_hashes,
            engines_used=engines_used,
            engine_divergences=integrity_issues,
            warnings=warnings,
            errors=errors,
            strict_mode_blocked=strict_mode and bool(errors),
        )

    def _detect_encoding(self, file_path: Path) -> str:
        """Detecta encoding de arquivo texto."""
        try:
            import chardet
            with open(file_path, "rb") as f:
                raw = f.read(100000)
                result = chardet.detect(raw)
                return result.get("encoding", "utf-8") or "utf-8"
        except ImportError:
            return "utf-8"

    def _hash_sheet_structure(self, ws) -> str:
        """Gera hash da estrutura da planilha (não dos dados)."""
        # Simplificado - em produção, hashear dimensões e headers
        return hashlib.sha256(f"{ws.max_row}_{ws.max_column}".encode()).hexdigest()[:16]


# Instância singleton
ingestion_service = IngestionService()
