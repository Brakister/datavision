"""Testes de analytics e heuristicas."""
from pathlib import Path

import duckdb
import pytest

from app.services.analytics import analytics_service


class TestAnalyticsService:
    """Testes do servico de analytics."""

    def test_map_duckdb_type_varchar(self):
        """Testa mapeamento de VARCHAR."""
        result = analytics_service._map_duckdb_type("VARCHAR")
        assert result == "string"

    def test_map_duckdb_type_integer(self):
        """Testa mapeamento de INTEGER."""
        result = analytics_service._map_duckdb_type("INTEGER")
        assert result == "integer"

    def test_map_duckdb_type_double(self):
        """Testa mapeamento de DOUBLE."""
        result = analytics_service._map_duckdb_type("DOUBLE")
        assert result == "float"

    def test_map_duckdb_type_timestamp(self):
        """Testa mapeamento de TIMESTAMP."""
        result = analytics_service._map_duckdb_type("TIMESTAMP")
        assert result == "datetime"

    def test_sanitize_table_name(self):
        """Testa sanitizacao."""
        result = analytics_service._sanitize_table_name("Dados Financeiros")
        assert result.startswith("sheet_")
        assert " " not in result

    def test_sales_csv_suggests_bar_chart(self, tmp_path: Path):
        file_uuid = "unit-test-sales"
        folder = tmp_path / file_uuid
        folder.mkdir(parents=True, exist_ok=True)
        db_path = folder / "analytics.db"

        conn = duckdb.connect(str(db_path))
        conn.execute(
            """
            CREATE TABLE sheet_data (
                departamento VARCHAR,
                vendas DOUBLE
            );
            """
        )
        conn.execute(
            """
            INSERT INTO sheet_data VALUES
            ('Vendas', 1000),
            ('RH', 450),
            ('Financeiro', 700),
            ('Vendas', 1300);
            """
        )
        conn.close()

        original_storage = analytics_service.storage_path
        analytics_service.storage_path = tmp_path
        try:
            suggestions = analytics_service.suggest_charts(file_uuid, "data")
        finally:
            analytics_service.storage_path = original_storage

        assert len(suggestions) <= 12
        assert any(s.chart_type == "bar" for s in suggestions)
        assert all(s.confidence_score >= 0 for s in suggestions)
        assert all(s.heuristic_rule for s in suggestions)

    def test_date_column_suggests_line_chart(self, tmp_path: Path):
        file_uuid = "unit-test-date"
        folder = tmp_path / file_uuid
        folder.mkdir(parents=True, exist_ok=True)
        db_path = folder / "analytics.db"

        conn = duckdb.connect(str(db_path))
        conn.execute(
            """
            CREATE TABLE sheet_data (
                data_ref VARCHAR,
                valor DOUBLE
            );
            """
        )
        conn.execute(
            """
            INSERT INTO sheet_data VALUES
            ('2024-01-01', 10),
            ('2024-01-02', 15),
            ('2024-01-03', 17),
            ('2024-01-04', 11);
            """
        )
        conn.close()

        original_storage = analytics_service.storage_path
        analytics_service.storage_path = tmp_path
        try:
            suggestions = analytics_service.suggest_charts(file_uuid, "data")
        finally:
            analytics_service.storage_path = original_storage

        assert any(s.chart_type == "line" for s in suggestions)
        scores = [s.confidence_score for s in suggestions]
        assert scores == sorted(scores, reverse=True)

    def test_financial_dataset_prioritizes_monthly_yearly_and_pie_charts(self, tmp_path: Path):
        file_uuid = "unit-test-finance"
        folder = tmp_path / file_uuid
        folder.mkdir(parents=True, exist_ok=True)
        db_path = folder / "analytics.db"

        conn = duckdb.connect(str(db_path))
        conn.execute(
            """
            CREATE TABLE sheet_financeiro (
                mes VARCHAR,
                ano INTEGER,
                categoria_despesa VARCHAR,
                status_receita VARCHAR,
                receita DOUBLE,
                despesa DOUBLE,
                saldo DOUBLE
            );
            """
        )
        conn.execute(
            """
            INSERT INTO sheet_financeiro VALUES
            ('Jan', 2025, 'Impostos', 'Realizada', 15000, 5000, 10000),
            ('Fev', 2025, 'Folha', 'Faturada', 18000, 6500, 11500),
            ('Mar', 2025, 'Sede', 'Realizada', 21000, 7200, 13800),
            ('Abr', 2025, 'Vendas', 'Faturada', 19500, 6800, 12700);
            """
        )
        conn.close()

        original_storage = analytics_service.storage_path
        analytics_service.storage_path = tmp_path
        try:
            suggestions = analytics_service.suggest_charts(file_uuid, "financeiro")
        finally:
            analytics_service.storage_path = original_storage

        titles = [suggestion.title for suggestion in suggestions]
        chart_types = [suggestion.chart_type for suggestion in suggestions]

        assert titles[0] == "Receitas mensais"
        assert "Despesas mensais" in titles
        assert "Saldos anuais" in titles
        assert "Divisao das receitas" in titles
        assert "Divisao das despesas" in titles
        assert "donut" in chart_types
        assert "pie" in chart_types

    def test_chart_data_bar_aggregation(self, tmp_path: Path):
        """Testa agregacao de dados para bar chart."""
        file_uuid = "unit-test-bar"
        folder = tmp_path / file_uuid
        folder.mkdir(parents=True, exist_ok=True)
        db_path = folder / "analytics.db"

        conn = duckdb.connect(str(db_path))
        conn.execute(
            """
            CREATE TABLE sheet_vendas (
                departamento VARCHAR,
                vendas DOUBLE
            );
            """
        )
        conn.execute(
            """
            INSERT INTO sheet_vendas VALUES
            ('Vendas', 1000),
            ('RH', 450),
            ('Financeiro', 700),
            ('Vendas', 1300);
            """
        )
        conn.close()

        original_storage = analytics_service.storage_path
        analytics_service.storage_path = tmp_path
        try:
            result = analytics_service.get_chart_data(
                file_uuid=file_uuid,
                sheet_name="vendas",
                chart_type="bar",
                dimension_columns=["departamento"],
                metric_columns=["vendas"],
                aggregation="sum",
            )
        finally:
            analytics_service.storage_path = original_storage

        assert result["chart_type"] == "bar"
        assert result["dimensions"] == ["departamento"]
        assert result["metrics"] == ["vendas"]
        assert result["total_rows"] == 3
        assert len(result["data"]) == 3
        assert "departamento" in result["data"][0]
        assert "vendas" in result["data"][0]

    def test_chart_data_line_temporal(self, tmp_path: Path):
        """Testa serie temporal para line chart."""
        file_uuid = "unit-test-line"
        folder = tmp_path / file_uuid
        folder.mkdir(parents=True, exist_ok=True)
        db_path = folder / "analytics.db"

        conn = duckdb.connect(str(db_path))
        conn.execute(
            """
            CREATE TABLE sheet_data (
                data_ref VARCHAR,
                valor DOUBLE
            );
            """
        )
        conn.execute(
            """
            INSERT INTO sheet_data VALUES
            ('2024-01-01', 10),
            ('2024-01-02', 15),
            ('2024-01-03', 17),
            ('2024-01-04', 11);
            """
        )
        conn.close()

        original_storage = analytics_service.storage_path
        analytics_service.storage_path = tmp_path
        try:
            result = analytics_service.get_chart_data(
                file_uuid=file_uuid,
                sheet_name="data",
                chart_type="line",
                dimension_columns=["data_ref"],
                metric_columns=["valor"],
                aggregation="sum",
            )
        finally:
            analytics_service.storage_path = original_storage

        assert result["chart_type"] == "line"
        assert result["total_rows"] == 4
        assert len(result["data"]) == 4
        assert all("data_ref" in row for row in result["data"])
        assert all("valor" in row for row in result["data"])

    def test_chart_data_scatter_raw_points(self, tmp_path: Path):
        """Testa scatter chart com pontos brutos (sem agregacao)."""
        file_uuid = "unit-test-scatter"
        folder = tmp_path / file_uuid
        folder.mkdir(parents=True, exist_ok=True)
        db_path = folder / "analytics.db"

        conn = duckdb.connect(str(db_path))
        conn.execute(
            """
            CREATE TABLE sheet_data (
                x_value DOUBLE,
                y_value DOUBLE
            );
            """
        )
        conn.execute(
            """
            INSERT INTO sheet_data VALUES
            (1, 2),
            (3, 5),
            (5, 7),
            (7, 9),
            (9, 11);
            """
        )
        conn.close()

        original_storage = analytics_service.storage_path
        analytics_service.storage_path = tmp_path
        try:
            result = analytics_service.get_chart_data(
                file_uuid=file_uuid,
                sheet_name="data",
                chart_type="scatter",
                dimension_columns=[],
                metric_columns=["x_value", "y_value"],
                aggregation="avg",
            )
        finally:
            analytics_service.storage_path = original_storage

        assert result["chart_type"] == "scatter"
        assert result["total_rows"] == 5
        assert len(result["data"]) == 5

    def test_chart_data_with_filters(self, tmp_path: Path):
        """Testa aplicacao de filtros na query."""
        file_uuid = "unit-test-filters"
        folder = tmp_path / file_uuid
        folder.mkdir(parents=True, exist_ok=True)
        db_path = folder / "analytics.db"

        conn = duckdb.connect(str(db_path))
        conn.execute(
            """
            CREATE TABLE sheet_data (
                categoria VARCHAR,
                valor DOUBLE
            );
            """
        )
        conn.execute(
            """
            INSERT INTO sheet_data VALUES
            ('A', 100),
            ('B', 200),
            ('A', 150),
            ('C', 300);
            """
        )
        conn.close()

        original_storage = analytics_service.storage_path
        analytics_service.storage_path = tmp_path
        try:
            result = analytics_service.get_chart_data(
                file_uuid=file_uuid,
                sheet_name="data",
                chart_type="bar",
                dimension_columns=["categoria"],
                metric_columns=["valor"],
                aggregation="sum",
                filters={"categoria": "A"},
            )
        finally:
            analytics_service.storage_path = original_storage

        assert result["total_rows"] == 1
        assert result["applied_filters"] == {"categoria": "A"}
        assert result["data"][0]["categoria"] == "A"

    def test_chart_data_respects_limit(self, tmp_path: Path):
        """Testa respeitance de limite de linhas."""
        file_uuid = "unit-test-limit"
        folder = tmp_path / file_uuid
        folder.mkdir(parents=True, exist_ok=True)
        db_path = folder / "analytics.db"

        conn = duckdb.connect(str(db_path))
        conn.execute(
            """
            CREATE TABLE sheet_data (
                id INTEGER,
                valor DOUBLE
            );
            """
        )
        for i in range(1, 101):
            conn.execute(f"INSERT INTO sheet_data VALUES ({i}, {i * 10})")
        conn.close()

        original_storage = analytics_service.storage_path
        analytics_service.storage_path = tmp_path
        try:
            result = analytics_service.get_chart_data(
                file_uuid=file_uuid,
                sheet_name="data",
                chart_type="bar",
                dimension_columns=["id"],
                metric_columns=["valor"],
                aggregation="sum",
                limit=10,
            )
        finally:
            analytics_service.storage_path = original_storage

        assert len(result["data"]) == 10
        assert result["total_rows"] == 10
