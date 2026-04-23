"""Testes de analytics e heuristicas."""
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
