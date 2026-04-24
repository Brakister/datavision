"""Serviço de analytics com heurísticas determinísticas para sugestão de gráficos.

TODA a lógica é determinística e auditável. Nenhuma IA é utilizada.
"""
from datetime import datetime
from pathlib import Path
import re
from typing import Any, Optional

import duckdb
import pandas as pd
import polars as pl

from app.core.config import get_settings
from app.core.logging import logger
from app.schemas import ChartSuggestion, ColumnSchema, ColumnType


settings = get_settings()

_PERCENT_RE = re.compile(r"^[-+]?\d+(?:[\.,]\d+)?\s*%$")
_CURRENCY_RE = re.compile(r"^(?:R\$|\$|€|£|¥)\s*[-+]?\d+(?:[\.,]\d+)?$")
_INT_RE = re.compile(r"^[-+]?\d+$")
_FLOAT_RE = re.compile(r"^[-+]?\d+[\.,]\d+$")


class AnalyticsService:
    """Serviço de análise e sugestão de visualizações."""

    def __init__(self):
        self.storage_path = Path(settings.STORAGE_PATH)

    def suggest_charts(self, file_uuid: str, sheet_name: str) -> list[ChartSuggestion]:
        """Sugere gráficos baseado em heurísticas determinísticas."""

        db_path = self.storage_path / file_uuid / "analytics.db"
        if not db_path.exists():
            return []

        conn = duckdb.connect(str(db_path), read_only=True)
        table_name = self._sanitize_table_name(sheet_name)

        try:
            schema_df = conn.execute(f"DESCRIBE {table_name}").fetchdf()
            columns = self._extract_column_info(conn, table_name, schema_df)
        except Exception as e:
            logger.error(f"Erro ao obter schema: {e}")
            conn.close()
            return []

        conn.close()

        categorical_cols = [c for c in columns if c.detected_type in ("categorical", "string", "boolean")]
        numeric_cols = [c for c in columns if c.detected_type in ("integer", "float", "decimal", "currency", "percentage")]
        date_cols = [c for c in columns if c.detected_type in ("date", "datetime")]

        suggestions = []

        # HEURISTICA 1: 1 dimensao categorica + 1 metrica = barras
        if categorical_cols and numeric_cols:
            for cat in categorical_cols[:3]:
                for num in numeric_cols[:3]:
                    if cat.cardinality <= 50:
                        suggestions.append(ChartSuggestion(
                            chart_type="bar",
                            title=f"{num.name} por {cat.name}",
                            description=f"Comparacao de {num.name} agrupado por {cat.name}",
                            dimension_columns=[cat.name],
                            metric_columns=[num.name],
                            confidence_score=0.95 if cat.cardinality <= 20 else 0.75,
                            heuristic_rule="categorical_1_metric_1: 1 dimensao categorica (card <=50) + 1 metrica -> bar chart",
                            recommended_aggregation="sum",
                        ))

        # HEURISTICA 2: 1 data + 1+ metricas = linha ou area
        if date_cols and numeric_cols:
            for date_col in date_cols[:2]:
                for num in numeric_cols[:2]:
                    suggestions.append(ChartSuggestion(
                        chart_type="line",
                        title=f"Evolucao de {num.name} ao longo do tempo",
                        description=f"Serie temporal de {num.name} por {date_col.name}",
                        dimension_columns=[date_col.name],
                        metric_columns=[num.name],
                        confidence_score=0.92,
                        heuristic_rule="temporal_1_metric_1: 1 coluna temporal + 1 metrica -> line chart",
                        recommended_aggregation="sum",
                    ))
                    suggestions.append(ChartSuggestion(
                        chart_type="area",
                        title=f"Area de {num.name} ao longo do tempo",
                        description=f"Visualizacao de area de {num.name} por {date_col.name}",
                        dimension_columns=[date_col.name],
                        metric_columns=[num.name],
                        confidence_score=0.85,
                        heuristic_rule="temporal_1_metric_1_area: 1 coluna temporal + 1 metrica -> area chart",
                        recommended_aggregation="sum",
                    ))

        # HEURISTICA 3: Categoria baixa cardinalidade + metrica = pizza/donut
        if categorical_cols and numeric_cols:
            for cat in categorical_cols:
                if 2 <= cat.cardinality <= 8:
                    for num in numeric_cols[:1]:
                        suggestions.append(ChartSuggestion(
                            chart_type="pie",
                            title=f"Distribuicao de {num.name} por {cat.name}",
                            description=f"Proporcao de {num.name} entre categorias de {cat.name}",
                            dimension_columns=[cat.name],
                            metric_columns=[num.name],
                            confidence_score=0.90,
                            heuristic_rule="low_cardinality_pie: categoria com cardinalidade 2-8 + 1 metrica -> pie chart",
                            recommended_aggregation="sum",
                        ))
                        suggestions.append(ChartSuggestion(
                            chart_type="donut",
                            title=f"Distribuicao de {num.name} por {cat.name}",
                            description=f"Proporcao de {num.name} entre categorias de {cat.name}",
                            dimension_columns=[cat.name],
                            metric_columns=[num.name],
                            confidence_score=0.88,
                            heuristic_rule="low_cardinality_donut: categoria com cardinalidade 2-8 + 1 metrica -> donut chart",
                            recommended_aggregation="sum",
                        ))

        # HEURISTICA 4: 2 metricas = scatter
        if len(numeric_cols) >= 2:
            for i, num1 in enumerate(numeric_cols[:3]):
                for num2 in numeric_cols[i+1:4]:
                    suggestions.append(ChartSuggestion(
                        chart_type="scatter",
                        title=f"Correlacao: {num1.name} vs {num2.name}",
                        description=f"Relacao entre {num1.name} e {num2.name}",
                        dimension_columns=[],
                        metric_columns=[num1.name, num2.name],
                        confidence_score=0.80,
                        heuristic_rule="two_metrics_scatter: 2 metricas numericas -> scatter plot",
                        recommended_aggregation="avg",
                    ))

        # HEURISTICA 5: Multiplas metricas por categoria = barras agrupadas
        if categorical_cols and len(numeric_cols) >= 2:
            for cat in categorical_cols[:2]:
                if cat.cardinality <= 20:
                    suggestions.append(ChartSuggestion(
                        chart_type="bar",
                        title=f"Metricas por {cat.name}",
                        description=f"Comparacao multipla por {cat.name}",
                        dimension_columns=[cat.name],
                        metric_columns=[n.name for n in numeric_cols[:4]],
                        confidence_score=0.85,
                        heuristic_rule="multi_metric_grouped_bar: 1 categoria + multiplas metricas -> grouped bar",
                        recommended_aggregation="sum",
                    ))

        # HEURISTICA 6: Hierarquia = treemap
        if len(categorical_cols) >= 2:
            hierarchy = [c.name for c in categorical_cols[:3]]
            if numeric_cols:
                suggestions.append(ChartSuggestion(
                    chart_type="treemap",
                    title="Hierarquia de categorias",
                    description=f"Visualizacao hierarquica: {' > '.join(hierarchy)}",
                    dimension_columns=hierarchy,
                    metric_columns=[numeric_cols[0].name],
                    confidence_score=0.75,
                    heuristic_rule="hierarchy_treemap: multiplas colunas categoricas -> treemap",
                    recommended_aggregation="sum",
                ))

        # HEURISTICA 7: KPI unico = radial bar ou card
        if numeric_cols:
            for num in numeric_cols[:2]:
                suggestions.append(ChartSuggestion(
                    chart_type="radial_bar",
                    title=f"KPI: {num.name}",
                    description=f"Indicador unico: {num.name}",
                    dimension_columns=[],
                    metric_columns=[num.name],
                    confidence_score=0.70,
                    heuristic_rule="single_kpi_radial: 1 metrica isolada -> radial bar / KPI card",
                    recommended_aggregation="sum",
                ))
                suggestions.append(ChartSuggestion(
                    chart_type="kpi",
                    title=f"KPI: {num.name}",
                    description=f"Indicador unico: {num.name}",
                    dimension_columns=[],
                    metric_columns=[num.name],
                    confidence_score=0.70,
                    heuristic_rule="single_kpi_card: 1 metrica isolada -> KPI card",
                    recommended_aggregation="sum",
                ))

        # HEURISTICA 8: Radar para multiplas metricas
        if len(numeric_cols) >= 3 and categorical_cols:
            for cat in categorical_cols[:1]:
                if cat.cardinality <= 10:
                    suggestions.append(ChartSuggestion(
                        chart_type="radar",
                        title=f"Perfil por {cat.name}",
                        description=f"Comparacao multidimensional por {cat.name}",
                        dimension_columns=[cat.name],
                        metric_columns=[n.name for n in numeric_cols[:6]],
                        confidence_score=0.72,
                        heuristic_rule="multi_metric_radar: 1 categoria + 3+ metricas -> radar chart",
                        recommended_aggregation="avg",
                    ))

        suggestions.sort(key=lambda x: x.confidence_score, reverse=True)
        return suggestions[:12]

    def get_chart_data(self, file_uuid: str, sheet_name: str, chart_type: str,
                       dimension_columns: list[str], metric_columns: list[str],
                       aggregation: str = "sum", filters: Optional[dict] = None,
                       limit: int = 1000) -> dict[str, Any]:
        """Gera dados agregados para um grafico especifico."""

        db_path = self.storage_path / file_uuid / "analytics.db"
        if not db_path.exists():
            raise FileNotFoundError(f"Banco de dados para {file_uuid} nao encontrado.")

        conn = duckdb.connect(str(db_path), read_only=True)
        table_name = self._sanitize_table_name(sheet_name)

        dims = [f'"{d}"' for d in dimension_columns]
        mets = [f'"{m}"' for m in metric_columns]

        # Scatter plot nao tem agregacao, retorna valores brutos
        if chart_type == "scatter" and len(mets) >= 2:
            select_cols = mets
            group_by = ""
        else:
            agg_funcs = {"sum": "SUM", "avg": "AVG", "count": "COUNT",
                         "min": "MIN", "max": "MAX", "distinct": "COUNT(DISTINCT"}
            agg = agg_funcs.get(aggregation, "SUM")

            agg_metrics = []
            for m_col in metric_columns:
                if aggregation == "distinct":
                    agg_metrics.append(f'{agg}("{m_col}")) AS "{m_col}"')
                elif aggregation == "count":
                    agg_metrics.append(f'{agg}("{m_col}") AS "{m_col}"')
                else:
                    # DuckDB pode ter colunas numericas como VARCHAR (ex: CSV).
                    # TRY_CAST evita falha e torna agregacao robusta.
                    agg_metrics.append(f'{agg}(TRY_CAST("{m_col}" AS DOUBLE)) AS "{m_col}"')

            select_cols = dims + agg_metrics
            group_by = f"GROUP BY {', '.join(dims)}" if dims else ""

        where_clause = ""
        if filters:
            conditions = []
            for col, val in filters.items():
                # Sanitiza nome da coluna para evitar injecao
                safe_col = f'"{col.replace("\"", "")}"'
                if isinstance(val, list):
                    placeholders = ", ".join(f"'{str(v).replace("'", "''")}'" for v in val)
                    conditions.append(f'{safe_col} IN ({placeholders})')
                elif isinstance(val, dict) and "min" in val and "max" in val:
                    conditions.append(f'{safe_col} BETWEEN {float(val["min"])} AND {float(val["max"])}')
                else:
                    conditions.append(f"{safe_col} = '{str(val).replace("'", "''")}'")
            if conditions:
                where_clause = "WHERE " + " AND ".join(conditions)

        order_by = f"ORDER BY {dims[0]}" if dims else ""
        limit_clause = f"LIMIT {min(limit, 10000)}"  # Hard limit

        query = f"SELECT {', '.join(select_cols)} FROM {table_name} {where_clause} {group_by} {order_by} {limit_clause}"

        try:
            logger.debug(f"Executando query de chart data: {query}")
            result_df = conn.execute(query).fetchdf()
            data = result_df.to_dict("records")
            total_rows = len(data)
        except Exception as e:
            logger.error(f"Erro na query de chart data: {e} | Query: {query}")
            data = []
            total_rows = 0
        finally:
            conn.close()

        return {
            "chart_type": chart_type,
            "dimensions": dimension_columns,
            "metrics": metric_columns,
            "data": data,
            "total_rows": total_rows,
            "applied_filters": filters or {},
            "generated_at": datetime.utcnow().isoformat(),
        }

    def get_table_data(self, file_uuid: str, sheet_name: str, page: int = 1,
                       page_size: int = 100, sort_by: Optional[str] = None,
                       sort_direction: str = "asc", filters: Optional[list] = None,
                       visible_columns: Optional[list[str]] = None) -> dict[str, Any]:
        """Retorna dados paginados para tabela."""

        db_path = self.storage_path / file_uuid / "analytics.db"
        conn = duckdb.connect(str(db_path), read_only=True)
        table_name = self._sanitize_table_name(sheet_name)

        offset = (page - 1) * page_size

        if visible_columns:
            cols = ", ".join(f'"{c}"' for c in visible_columns)
        else:
            cols = "*"

        where_clause = ""
        if filters:
            conditions = []
            for f in filters:
                col = f.get("column")
                op = f.get("operator")
                val = f.get("value")

                if op == "equals":
                    conditions.append(f'"{col}" = \'{val}\'')
                elif op == "contains":
                    conditions.append(f'"{col}" LIKE \'%{val}%\'')
                elif op == "greater_than":
                    conditions.append(f'"{col}" > {val}')
                elif op == "less_than":
                    conditions.append(f'"{col}" < {val}')
                elif op == "between":
                    val_to = f.get("value_to")
                    conditions.append(f'"{col}" BETWEEN {val} AND {val_to}')
                elif op == "is_null":
                    conditions.append(f'"{col}" IS NULL')

            if conditions:
                where_clause = "WHERE " + " AND ".join(conditions)

        order_clause = ""
        if sort_by:
            direction = "DESC" if sort_direction == "desc" else "ASC"
            order_clause = f'ORDER BY "{sort_by}" {direction}'

        query = f"SELECT {cols} FROM {table_name} {where_clause} {order_clause} LIMIT {page_size} OFFSET {offset}"
        count_query = f"SELECT COUNT(*) as total FROM {table_name} {where_clause}"

        try:
            result_df = conn.execute(query).fetchdf()
            count_result = conn.execute(count_query).fetchone()
            total_rows = count_result[0] if count_result else 0
            data = result_df.to_dict("records")
        except Exception as e:
            logger.error(f"Erro na query de tabela: {e}")
            data = []
            total_rows = 0
        finally:
            conn.close()

        total_pages = (total_rows + page_size - 1) // page_size

        return {
            "data": data,
            "page": page,
            "page_size": page_size,
            "total_rows": total_rows,
            "total_pages": total_pages,
            "applied_filters": filters or [],
        }

    def _extract_column_info(self, conn, table_name: str, schema_df) -> list[ColumnSchema]:
        """Extrai informacoes detalhadas das colunas via DuckDB."""
        columns = []

        for idx, row in schema_df.iterrows():
            col_name = row["column_name"]
            col_type = row["column_type"]
            quoted_col = f'"{col_name}"'

            try:
                stats_query = (
                    f"SELECT "
                    f"COUNT(*) as total, "
                    f"COUNT(*) FILTER (WHERE {quoted_col} IS NULL) as null_count, "
                    f"COUNT(DISTINCT {quoted_col}) as unique_count "
                    f"FROM {table_name}"
                )
                total, null_count, unique_count = conn.execute(stats_query).fetchone()
                cardinality = unique_count
                samples_df = conn.execute(
                    f"SELECT {quoted_col} FROM {table_name} WHERE {quoted_col} IS NOT NULL LIMIT 50"
                ).fetchdf()
                samples = [str(v) for v in samples_df[col_name].tolist()]
            except Exception:
                total = 0
                unique_count = 0
                null_count = 0
                cardinality = 0
                samples = []

            detected_type = self._map_duckdb_type(col_type)
            if detected_type == "string":
                detected_type = self._infer_string_type(samples)

            col_schema = ColumnSchema(
                name=col_name,
                index=idx,
                detected_type=detected_type,
                null_count=int(null_count),
                unique_count=int(unique_count),
                cardinality=int(cardinality),
                sample_values=samples[:10],
            )
            columns.append(col_schema)

        return columns

    def _map_duckdb_type(self, duckdb_type: str) -> ColumnType:
        """Mapeia tipo DuckDB para tipo interno."""
        dt = duckdb_type.upper()

        if "VARCHAR" in dt or "TEXT" in dt or "CHAR" in dt:
            return "string"
        elif "INTEGER" in dt or "BIGINT" in dt or "SMALLINT" in dt or "TINYINT" in dt:
            return "integer"
        elif "DOUBLE" in dt or "FLOAT" in dt or "REAL" in dt:
            return "float"
        elif "DECIMAL" in dt or "NUMERIC" in dt:
            return "decimal"
        elif "BOOLEAN" in dt:
            return "boolean"
        elif "DATE" in dt and "TIME" not in dt:
            return "date"
        elif "TIMESTAMP" in dt or "DATETIME" in dt:
            return "datetime"
        else:
            return "mixed"

    def _infer_string_type(self, samples: list[str]) -> ColumnType:
        """Infere tipos especiais em colunas string de forma deterministica."""
        if not samples:
            return "empty"

        lowered = [s.strip().lower() for s in samples if s.strip()]
        if not lowered:
            return "empty"

        if all(_PERCENT_RE.match(s.strip()) for s in samples if s.strip()):
            return "percentage"
        if all(_CURRENCY_RE.match(s.strip()) for s in samples if s.strip()):
            return "currency"

        bool_values = {"true", "false", "yes", "no", "sim", "nao", "1", "0"}
        if all(v in bool_values for v in lowered):
            return "boolean"

        date_hits = sum(1 for s in samples if self._looks_like_date(s))
        if date_hits / len(samples) >= 0.85:
            return "date"

        int_hits = sum(1 for s in samples if _INT_RE.match(s.strip()))
        float_hits = sum(1 for s in samples if _FLOAT_RE.match(s.strip()))
        if int_hits == len(samples):
            return "integer"
        if int_hits + float_hits == len(samples) and float_hits > 0:
            return "float"

        uniq_ratio = len(set(lowered)) / len(lowered)
        if len(set(lowered)) <= 50 and uniq_ratio <= 0.2:
            return "categorical"

        return "string"

    def _looks_like_date(self, value: str) -> bool:
        parsed = pd.to_datetime(value, errors="coerce", dayfirst=True)
        return not pd.isna(parsed)

    def _sanitize_table_name(self, name: str) -> str:
        """Sanitiza nome para SQL."""
        sanitized = "".join(c if c.isalnum() else "_" for c in name)
        return f"sheet_{sanitized}"[:60]


analytics_service = AnalyticsService()
