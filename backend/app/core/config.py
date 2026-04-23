"""Configurações centralizadas da aplicação."""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configurações da aplicação carregadas de variáveis de ambiente."""

    # Aplicação
    APP_NAME: str = "DataVision"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Servidor
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Banco de dados
    DATABASE_URL: str = "postgresql+asyncpg://datavision:datavision@postgres:5432/datavision"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Storage
    STORAGE_TYPE: str = "local"  # local ou s3
    STORAGE_PATH: str = "/app/storage"
    S3_ENDPOINT: str = ""
    S3_BUCKET: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""

    # Processamento
    MAX_FILE_SIZE_MB: int = 500
    CHUNK_SIZE_BYTES: int = 1024 * 1024  # 1MB
    WORKER_CONCURRENCY: int = 4

    # DuckDB
    DUCKDB_PATH: str = "/app/storage/analytics.db"

    # Segurança
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Retorna instância cacheada das configurações."""
    return Settings()
