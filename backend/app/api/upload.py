"""Endpoints de upload e processamento de arquivos."""
import hashlib
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    FileTooLargeException,
    InconsistencyException,
    UnsupportedFormatException,
    ValidationException,
)
from app.core.logging import logger
from app.db.database import get_db
from app.models import FileUpload
from app.schemas import UploadResponse
from app.services.ingestion import ingestion_service
from app.services.local_store import load_record, save_record

router = APIRouter(prefix="/upload", tags=["Upload"])
settings = get_settings()


@router.post("", response_model=UploadResponse)
async def upload_file(
    db: AsyncSession | None = Depends(get_db),
    file: UploadFile = File(...),
    strict_mode: bool = Form(False),
    preferred_date_format: Optional[str] = Form(None),
    encoding: Optional[str] = Form(None),
    delimiter: Optional[str] = Form(None),
):
    """Recebe arquivo tabular, valida, salva em storage e persiste metadados."""

    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()
    supported = {".xlsx", ".xls", ".xlsm", ".xlsb", ".csv", ".tsv", ".ods"}

    if ext not in supported:
        raise UnsupportedFormatException(
            f"Formato nao suportado: {ext}. Suportados: {sorted(supported)}"
        )

    max_size_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    chunk_size = settings.CHUNK_SIZE_BYTES

    storage_root = Path(settings.STORAGE_PATH)
    storage_root.mkdir(parents=True, exist_ok=True)
    tmp_root = storage_root / "_tmp"
    tmp_root.mkdir(parents=True, exist_ok=True)

    hash_sha256 = hashlib.sha256()
    file_size_bytes = 0

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext, dir=tmp_root) as tmp:
        tmp_path = Path(tmp.name)
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            file_size_bytes += len(chunk)
            if file_size_bytes > max_size_bytes:
                tmp_path.unlink(missing_ok=True)
                raise FileTooLargeException(
                    f"Arquivo excede o limite de {settings.MAX_FILE_SIZE_MB}MB"
                )
            hash_sha256.update(chunk)
            tmp.write(chunk)

    if file_size_bytes == 0:
        tmp_path.unlink(missing_ok=True)
        raise ValidationException("Arquivo vazio nao pode ser processado")

    file_hash = hash_sha256.hexdigest()
    file_uuid = uuid.uuid5(uuid.NAMESPACE_URL, file_hash)

    file_dir = storage_root / str(file_uuid)
    file_dir.mkdir(parents=True, exist_ok=True)
    final_path = file_dir / f"original{ext}"

    if not final_path.exists():
        tmp_path.replace(final_path)
    else:
        tmp_path.unlink(missing_ok=True)

    record_status = "processing"
    record_metadata = {
        "storage_path": str(final_path),
        "strict_mode": strict_mode,
        "preferred_date_format": preferred_date_format,
        "encoding": encoding,
        "delimiter": delimiter,
    }

    record = None
    if db is not None:
        existing = await db.scalar(
            select(FileUpload).where(FileUpload.file_hash_sha256 == file_hash)
        )

        if existing is None:
            record = FileUpload(
                id=file_uuid,
                original_filename=filename[:255],
                file_size_bytes=file_size_bytes,
                file_hash_sha256=file_hash,
                file_format=ext.lstrip("."),
                status=record_status,
                metadata_json=record_metadata,
            )
            db.add(record)
            await db.commit()
            await db.refresh(record)
        else:
            record = existing
            record_status = record.status
            record_metadata = record.metadata_json or record_metadata
    else:
        # Modo local: tenta deduplicar por hash via arquivo JSON
        existing_local = load_record(str(file_uuid))
        if existing_local and existing_local.get("file_hash_sha256") == file_hash:
            record_status = existing_local.get("status", "processing")
            record_metadata = existing_local.get("metadata_json", record_metadata)

    # Processamento síncrono (Fase 1/3): gera analytics.db e relatório de integridade
    try:
        result = await ingestion_service.process_upload(
            file_path=str(final_path),
            original_filename=filename,
            strict_mode=strict_mode,
            preferred_date_format=preferred_date_format,
            encoding=encoding,
            delimiter=delimiter,
        )

        record_status = result.get("status", "completed")
        record_metadata = {
            **(record_metadata or {}),
            "integrity_report": result.get("integrity_report"),
            "sheets": result.get("sheets"),
            "duckdb_path": result.get("duckdb_path"),
            "storage_path": result.get("storage_path", str(final_path)),
            "processing_time_seconds": result.get("processing_time_seconds"),
        }

        if db is not None and record is not None:
            record.status = record_status
            record.metadata_json = record_metadata
            await db.commit()
        else:
            save_record(
                str(file_uuid),
                {
                    "id": str(file_uuid),
                    "original_filename": filename,
                    "file_size_bytes": file_size_bytes,
                    "file_hash_sha256": file_hash,
                    "file_format": ext.lstrip("."),
                    "status": record_status,
                    "metadata_json": record_metadata,
                },
            )

    except InconsistencyException as exc:
        # Modo estrito: salva relatório e marca como inconsistente
        meta = getattr(exc, "meta", None) or {}
        record_status = "inconsistent"
        record_metadata = {
            **(record_metadata or {}),
            "integrity_report": meta.get("integrity_report"),
            "sheets": meta.get("sheets"),
        }

        if db is not None and record is not None:
            record.status = record_status
            record.metadata_json = record_metadata
            await db.commit()
        else:
            save_record(
                str(file_uuid),
                {
                    "id": str(file_uuid),
                    "original_filename": filename,
                    "file_size_bytes": file_size_bytes,
                    "file_hash_sha256": file_hash,
                    "file_format": ext.lstrip("."),
                    "status": record_status,
                    "metadata_json": record_metadata,
                },
            )
        raise
    except Exception as exc:
        record_status = "failed"
        record_metadata = {**(record_metadata or {}), "error": str(exc)}

        if db is not None and record is not None:
            record.status = record_status
            record.metadata_json = record_metadata
            await db.commit()
        else:
            save_record(
                str(file_uuid),
                {
                    "id": str(file_uuid),
                    "original_filename": filename,
                    "file_size_bytes": file_size_bytes,
                    "file_hash_sha256": file_hash,
                    "file_format": ext.lstrip("."),
                    "status": record_status,
                    "metadata_json": record_metadata,
                },
            )
        raise

    logger.info(
        "Upload salvo",
        extra={
            "file_uuid": str(file_uuid),
            "original_filename": filename,
            "size_bytes": file_size_bytes,
            "file_hash": file_hash,
            "status": "pending",
        },
    )

    return UploadResponse(
        file_uuid=str(file_uuid),
        original_filename=filename,
        file_size_bytes=file_size_bytes,
        status=record_status,
        message="Arquivo recebido e processado." if record_status != "pending" else "Arquivo recebido com sucesso e aguardando processamento.",
        strict_mode=strict_mode,
    )


@router.get("/{file_uuid}/status")
async def get_processing_status(file_uuid: str, db: AsyncSession | None = Depends(get_db)):
    """Retorna status atual do processamento."""
    try:
        parsed_uuid = uuid.UUID(file_uuid)
    except ValueError as exc:
        raise ValidationException("UUID invalido", error_code="INVALID_UUID", status_code=400) from exc

    if db is not None:
        file_record = await db.get(FileUpload, parsed_uuid)
        if file_record is None:
            raise ValidationException("Arquivo nao encontrado", error_code="FILE_NOT_FOUND", status_code=404)
        status = file_record.status
    else:
        local = load_record(file_uuid)
        if local is None:
            raise ValidationException("Arquivo nao encontrado", error_code="FILE_NOT_FOUND", status_code=404)
        status = local.get("status", "pending")

    return {
        "file_uuid": file_uuid,
        "status": status,
        "progress": 0 if status == "pending" else 100,
        "message": "Aguardando processamento" if status == "pending" else "Processamento concluido",
    }
