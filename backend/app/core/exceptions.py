"""Excecoes customizadas e handlers globais da aplicacao."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette import status

from app.core.logging import logger


def _utc_timestamp() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


class DataVisionException(Exception):
    """Excecao base da aplicacao com contrato padronizado de erro."""

    def __init__(
        self,
        detail: str,
        *,
        error_code: str = "APP_ERROR",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        meta: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        self.error_code = error_code
        self.status_code = status_code
        self.meta = meta or {}

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "detail": self.detail,
            "error_code": self.error_code,
            "timestamp": _utc_timestamp(),
        }
        if self.meta:
            payload["meta"] = self.meta
        return payload


class IngestionException(DataVisionException):
    def __init__(self, detail: str, **kwargs: Any) -> None:
        super().__init__(
            detail,
            error_code="INGESTION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            **kwargs,
        )


class ValidationException(DataVisionException):
    def __init__(self, detail: str, **kwargs: Any) -> None:
        super().__init__(
            detail,
            error_code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            **kwargs,
        )


class InconsistencyException(DataVisionException):
    def __init__(self, detail: str, **kwargs: Any) -> None:
        super().__init__(
            detail,
            error_code="INCONSISTENT_FILE",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            **kwargs,
        )


class UnsupportedFormatException(DataVisionException):
    def __init__(self, detail: str, **kwargs: Any) -> None:
        super().__init__(
            detail,
            error_code="UNSUPPORTED_FORMAT",
            status_code=status.HTTP_400_BAD_REQUEST,
            **kwargs,
        )


class FileTooLargeException(DataVisionException):
    def __init__(self, detail: str, **kwargs: Any) -> None:
        super().__init__(
            detail,
            error_code="FILE_TOO_LARGE",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            **kwargs,
        )


def register_exception_handlers(app: FastAPI) -> None:
    """Registra handlers globais para respostas de erro estruturadas."""

    @app.exception_handler(DataVisionException)
    async def handle_app_exception(_: Request, exc: DataVisionException) -> JSONResponse:
        logger.warning(
            "Erro de dominio",
            extra={"error_code": exc.error_code, "detail": exc.detail},
        )
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    @app.exception_handler(HTTPException)
    async def handle_http_exception(_: Request, exc: HTTPException) -> JSONResponse:
        payload = {
            "detail": str(exc.detail),
            "error_code": "HTTP_ERROR",
            "timestamp": _utc_timestamp(),
        }
        return JSONResponse(status_code=exc.status_code, content=payload)

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Erro inesperado", exc_info=exc)
        payload = {
            "detail": "Erro interno do servidor",
            "error_code": "INTERNAL_ERROR",
            "timestamp": _utc_timestamp(),
        }
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=payload)
