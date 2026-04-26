"""Endpoints de upload e processamento de arquivos."""
import asyncio
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
    UnsupportedFormatException,
    ValidationException,
)
from app.core.logging import logger
from app.db.database import AsyncSessionLocal, get_db
from app.models import FileUpload
from app.schemas import UploadResponse
from app.services.ingestion import ingestion_service
from app.services.local_store import load_record, save_record

router = APIRouter(prefix="/upload", tags=["Upload"])
settings = get_settings()


def _build_record_payload(
    *,
    file_uuid: str,
    filename: str,
    file_size_bytes: int,
    file_hash: str,
    ext: str,
    strict_mode: bool,
    status: str,
    metadata_json: dict,
) -> dict:
    return {
        "id": file_uuid,
        "original_filename": filename,
        "file_size_bytes": file_size_bytes,
        "file_hash_sha256": file_hash,
        "file_format": ext.lstrip("."),
        "status": status,
        "metadata_json": metadata_json,
    }


async def _persist_record(
    *,
    file_uuid: str,
    payload: dict,
    use_db: bool,
) -> None:
    if use_db:
        try:
            parsed_uuid = uuid.UUID(file_uuid)
            async with AsyncSessionLocal() as session:
                record = await session.get(FileUpload, parsed_uuid)
                if record is not None:
                    record.status = payload.get("status", record.status)
                    record.metadata_json = payload.get("metadata_json", record.metadata_json or {})
                    await session.commit()
                    return
        except Exception:
            logger.exception("Falha ao persistir estado do upload no banco; usando storage local")

    save_record(file_uuid, payload)


async def _run_processing_job(
    *,
    file_uuid: str,
    file_path: str,
    original_filename: str,
    file_size_bytes: int,
    file_hash: str,
    strict_mode: bool,
    preferred_date_format: Optional[str],
    encoding: Optional[str],
    delimiter: Optional[str],
    use_db: bool,
    ext: str,
) -> None:
    async def update_progress(stage: str, progress: int, message: str) -> None:
        current_record = load_record(file_uuid) or {}
        metadata_json = dict(current_record.get("metadata_json") or {})
        metadata_json["processing_progress"] = {
            "status": "processing",
            "stage": stage,
            "progress": progress,
            "message": message,
        }
        payload = _build_record_payload(
            file_uuid=file_uuid,
            filename=original_filename,
            file_size_bytes=file_size_bytes,
            file_hash=file_hash,
            ext=ext,
            strict_mode=strict_mode,
            status="processing",
            metadata_json=metadata_json,
        )
        await _persist_record(file_uuid=file_uuid, payload=payload, use_db=use_db)

    try:
        result = await ingestion_service.process_upload(
            file_path=file_path,
            original_filename=original_filename,
            strict_mode=strict_mode,
            preferred_date_format=preferred_date_format,
            encoding=encoding,
            delimiter=delimiter,
            progress_callback=update_progress,
        )

        metadata_json = {
            "strict_mode": strict_mode,
            "integrity_report": result.get("integrity_report"),
            "sheets": result.get("sheets"),
            "duckdb_path": result.get("duckdb_path"),
            "storage_path": result.get("storage_path", file_path),
            "processing_time_seconds": result.get("processing_time_seconds"),
            "processing_progress": {
                "status": result.get("status", "completed"),
                "stage": "finalizing",
                "progress": 100,
                "message": "Processamento concluido",
            },
        }

        payload = _build_record_payload(
            file_uuid=file_uuid,
            filename=original_filename,
            file_size_bytes=file_size_bytes,
            file_hash=file_hash,
            ext=ext,
            strict_mode=strict_mode,
            status=result.get("status", "completed"),
            metadata_json=metadata_json,
        )
        await _persist_record(file_uuid=file_uuid, payload=payload, use_db=use_db)
    except Exception as exc:
        logger.exception("Falha no processamento assíncrono do upload", extra={"file_uuid": file_uuid})
        current_record = load_record(file_uuid) or {}
        metadata_json = dict(current_record.get("metadata_json") or {})
        metadata_json["error"] = str(exc)
        metadata_json["processing_progress"] = {
            "status": "failed",
            "stage": "failed",
            "progress": 100,
            "message": "Falha ao processar o arquivo",
        }

        payload = _build_record_payload(
            file_uuid=file_uuid,
            filename=original_filename,
            file_size_bytes=file_size_bytes,
            file_hash=file_hash,
            ext=ext,
            strict_mode=strict_mode,
            status="failed",
            metadata_json=metadata_json,
        )
        await _persist_record(file_uuid=file_uuid, payload=payload, use_db=use_db)


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
    should_schedule = True
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
            should_schedule = record_status == "failed"
    else:
        # Modo local: tenta deduplicar por hash via arquivo JSON
        existing_local = load_record(str(file_uuid))
        if existing_local and existing_local.get("file_hash_sha256") == file_hash:
            record_status = existing_local.get("status", "processing")
            record_metadata = existing_local.get("metadata_json", record_metadata)
            should_schedule = record_status == "failed"

    if should_schedule:
        initial_progress = {
            "status": "processing",
            "stage": "queued",
            "progress": 0,
            "message": "Arquivo recebido. Aguardando processamento.",
        }
        record_metadata = {**(record_metadata or {}), "processing_progress": initial_progress}

        if db is not None and record is not None:
            record.status = "processing"
            record.metadata_json = record_metadata
            await db.commit()
        else:
            save_record(
                str(file_uuid),
                _build_record_payload(
                    file_uuid=str(file_uuid),
                    filename=filename,
                    file_size_bytes=file_size_bytes,
                    file_hash=file_hash,
                    ext=ext,
                    strict_mode=strict_mode,
                    status="processing",
                    metadata_json=record_metadata,
                ),
            )

    if should_schedule:
        asyncio.create_task(
            _run_processing_job(
                file_uuid=str(file_uuid),
                file_path=str(final_path),
                original_filename=filename,
                file_size_bytes=file_size_bytes,
                file_hash=file_hash,
                strict_mode=strict_mode,
                preferred_date_format=preferred_date_format,
                encoding=encoding,
                delimiter=delimiter,
                use_db=db is not None,
                ext=ext,
            )
        )

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
        status="processing" if should_schedule else record_status,
        message="Arquivo recebido. Processamento em andamento." if should_schedule else "Arquivo ja processado.",
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
        metadata_json = file_record.metadata_json or {}
    else:
        local = load_record(file_uuid)
        if local is None:
            raise ValidationException("Arquivo nao encontrado", error_code="FILE_NOT_FOUND", status_code=404)
        status = local.get("status", "pending")
        metadata_json = local.get("metadata_json") or {}

    progress = metadata_json.get("processing_progress", {})

    return {
        "file_uuid": file_uuid,
        "status": status,
        "stage": progress.get("stage", "queued" if status == "pending" else "finalizing"),
        "progress": int(progress.get("progress", 0 if status == "pending" else 100)),
        "message": progress.get(
            "message",
            "Aguardando processamento" if status == "pending" else "Processamento concluido",
        ),
    }
