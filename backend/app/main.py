"""DataVision Backend - Aplicacao FastAPI principal."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.logging import logger
from app.api import upload, files, analytics

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerenciamento de ciclo de vida da aplicacao."""
    logger.info("DataVision iniciando", extra={"version": settings.APP_VERSION})
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(upload.router)
app.include_router(files.router)
app.include_router(analytics.router)


@app.get("/health")
async def health_check():
    """Endpoint de health check."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "service": settings.APP_NAME,
    }


@app.get("/")
async def root():
    """Redirect para documentacao."""
    return {"message": "DataVision API", "docs": "/docs"}
