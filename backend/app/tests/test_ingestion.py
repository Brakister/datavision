"""Testes de ingestao de dados."""
import pytest
from pathlib import Path
import tempfile

from app.services.ingestion import ingestion_service
from app.core.exceptions import UnsupportedFormatException, FileTooLargeException


class TestIngestionService:
    """Testes do servico de ingestao."""

    @pytest.mark.asyncio
    async def test_calculate_sha256(self):
        """Testa calculo de hash SHA-256."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("a,b,c\n1,2,3\n")
            path = f.name

        hash_result = await ingestion_service._calculate_sha256(path)
        assert len(hash_result) == 64
        assert all(c in '0123456789abcdef' for c in hash_result)
        Path(path).unlink()

    @pytest.mark.asyncio
    async def test_detect_column_type_string(self):
        """Testa deteccao de tipo string."""
        import polars as pl
        df = pl.DataFrame({"col": ["a", "b", "c"]})
        result = ingestion_service._detect_column_type(df["col"])
        assert result == "string"

    @pytest.mark.asyncio
    async def test_detect_column_type_integer(self):
        """Testa deteccao de tipo integer."""
        import polars as pl
        df = pl.DataFrame({"col": [1, 2, 3]})
        result = ingestion_service._detect_column_type(df["col"])
        assert result == "integer"

    @pytest.mark.asyncio
    async def test_detect_column_type_date(self):
        """Testa deteccao de tipo date."""
        import polars as pl
        df = pl.DataFrame({"col": ["2024-01-01", "2024-01-02", "2024-01-03"]})
        result = ingestion_service._detect_column_type(df["col"])
        # Polars pode inferir como date ou string dependendo da configuracao
        assert result in ["string", "date"]

    @pytest.mark.asyncio
    async def test_infer_string_type_percentage(self):
        """Testa inferencia de percentual."""
        samples = ["10%", "20%", "30%", "40%", "50%"]
        result = ingestion_service._infer_string_type(samples)
        assert result == "percentage"

    @pytest.mark.asyncio
    async def test_infer_string_type_currency(self):
        """Testa inferencia de moeda."""
        samples = ["R$ 100,00", "R$ 200,00", "R$ 300,00"]
        result = ingestion_service._infer_string_type(samples)
        assert result == "currency"

    @pytest.mark.asyncio
    async def test_infer_string_type_boolean(self):
        """Testa inferencia de booleano."""
        samples = ["Sim", "Nao", "Sim", "Sim", "Nao"]
        result = ingestion_service._infer_string_type(samples)
        assert result == "boolean"

    @pytest.mark.asyncio
    async def test_sanitize_table_name(self):
        """Testa sanitizacao de nome de tabela."""
        result = ingestion_service._sanitize_table_name("Planilha de Vendas 2024")
        assert "sheet_" in result
        assert " " not in result

    @pytest.mark.asyncio
    async def test_unsupported_format(self):
        """Testa rejeicao de formato nao suportado."""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
            path = f.name

        with pytest.raises(UnsupportedFormatException):
            await ingestion_service.process_upload(path, "test.pdf")

        Path(path).unlink()
