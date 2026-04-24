"""DataVision Backend - Aplicacao FastAPI principal."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import logger
from app.api import upload, files, analytics
from app.db.database import check_db_connection, run_migrations

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerenciamento de ciclo de vida da aplicacao."""
    logger.info("DataVision iniciando", extra={"version": settings.APP_VERSION})

    if settings.AUTO_RUN_MIGRATIONS:
        run_migrations()

    yield
    logger.info("DataVision encerrando")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    DataVision - Transformacao de Excel/CSV em Dashboards Interativos.

    Sistema determinístico, auditavel e de alta performance para leitura,
    validacao e visualizacao de dados tabulares.

    ## Caracteristicas
    - Leitura multi-engine com validacao de integridade
    - Heuristicas determinísticas para sugestao de graficos
    - Filtros avancados cross-dashboard
    - Exportacao multi-formato
    - Zero uso de IA/LLM
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

# Routers
app.include_router(upload.router)
app.include_router(files.router)
app.include_router(analytics.router)


@app.get("/health")
async def health_check():
    """Endpoint de health check."""
    db_ok = await check_db_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "version": settings.APP_VERSION,
        "service": settings.APP_NAME,
        "database": "ok" if db_ok else "unavailable",
    }


@app.get("/health/db")
async def health_db_check():
    """Verifica conectividade com PostgreSQL via query simples."""
    db_ok = await check_db_connection()
    return {
        "status": "ok" if db_ok else "error",
        "query": "SELECT 1",
    }


@app.get("/")
async def root():
    """Redirect para documentacao."""
    return {"message": "DataVision API", "docs": "/docs"}
