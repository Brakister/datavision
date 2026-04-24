"""Configuracoes centralizadas da aplicacao."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuracoes da aplicacao carregadas de variaveis de ambiente."""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    # Aplicação
    APP_NAME: str = "DataVision"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Servidor
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Banco de dados
    DATABASE_URL: str = "postgresql+asyncpg://datavision:datavision@postgres:5432/datavision"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

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
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    CORS_ALLOW_CREDENTIALS: bool = True

    # Migrations
    AUTO_RUN_MIGRATIONS: bool = True


@lru_cache
def get_settings() -> Settings:
    """Retorna instancia cacheada das configuracoes."""
    return Settings()
