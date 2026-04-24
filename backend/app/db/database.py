"""Configuracao de banco de dados assincrono e utilitarios de startup."""
from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db():
    """Dependency para obter sessao do banco."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def check_db_connection() -> bool:
    """Executa uma query simples para validar conectividade com PostgreSQL."""
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
            return True
    except Exception:
        logger.exception("Falha no health check do banco")
        return False


def run_migrations() -> None:
    """Executa alembic upgrade head de forma programatica."""
    backend_root = Path(__file__).resolve().parents[2]
    alembic_ini = backend_root / "alembic.ini"

    if not alembic_ini.exists():
        logger.warning("alembic.ini nao encontrado; migrations nao executadas")
        return

    alembic_cfg = Config(str(alembic_ini))
    alembic_cfg.set_main_option("script_location", str(backend_root / "migrations"))
    command.upgrade(alembic_cfg, "head")
