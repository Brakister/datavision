"""Endpoints de upload e processamento de arquivos."""
import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.exceptions import DataVisionException
from app.core.logging import logger
from app.schemas import UploadResponse, ProcessingProgress
from app.services.ingestion import ingestion_service

router = APIRouter(prefix="/upload", tags=["Upload"])
settings = get_settings()


@router.post("", response_model=UploadResponse)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    strict_mode: bool = Form(False),
    preferred_date_format: Optional[str] = Form(None),
    encoding: Optional[str] = Form(None),
    delimiter: Optional[str] = Form(None),
):
    """Recebe arquivo Excel/CSV e inicia processamento assincrono.

    - **strict_mode**: Quando ativado, qualquer inconsistencia bloqueia geracao automatica
    - **preferred_date_format**: Formato preferencial para datas ambiguas
    - **encoding**: Encoding para arquivos CSV/TSV
    - **delimiter**: Delimitador para CSV/TSV
    """

    # Validar extensao
    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()
    supported = {".xlsx", ".xls", ".xlsm", ".xlsb", ".csv", ".tsv", ".ods"}

    if ext not in supported:
        raise HTTPException(
            status_code=400,
            detail=f"Formato nao suportado: {ext}. Suportados: {supported}"
        )

    # Salvar arquivo temporario
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Processar sincronamente (em producao, usar Celery/RQ)
        result = await ingestion_service.process_upload(
            file_path=tmp_path,
            original_filename=filename,
            strict_mode=strict_mode,
            preferred_date_format=preferred_date_format,
            encoding=encoding,
            delimiter=delimiter,
        )

        return UploadResponse(
            file_uuid=result["uuid"],
            original_filename=result["original_filename"],
            file_size_bytes=result["file_size_bytes"],
            status=result["status"],
            message=f"Arquivo processado com sucesso. {result['total_sheets']} aba(s), {result['total_rows']} linha(s).",
            strict_mode=strict_mode,
        )

    except DataVisionException as e:
        logger.error(f"Erro no upload: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Erro inesperado no upload: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")
    finally:
        # Limpar arquivo temporario
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/{file_uuid}/status")
async def get_processing_status(file_uuid: str):
    """Retorna status atual do processamento."""
    # Em producao, consultar Redis/DB para status real
    return {
        "file_uuid": file_uuid,
        "status": "completed",
        "progress": 100,
        "message": "Processamento concluido",
    }
