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
from app.core.exceptions import FileTooLargeException, UnsupportedFormatException, ValidationException
from app.core.logging import logger
from app.db.database import get_db
from app.models import FileUpload
from app.schemas import UploadResponse

router = APIRouter(prefix="/upload", tags=["Upload"])
settings = get_settings()


@router.post("", response_model=UploadResponse)
async def upload_file(
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
    strict_mode: bool = Form(False),
    preferred_date_format: Optional[str] = Form(None),
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

    existing = await db.scalar(
        select(FileUpload).where(FileUpload.file_hash_sha256 == file_hash)
    )

    if existing is None:
        metadata = {
            "storage_path": str(final_path),
            "strict_mode": strict_mode,
            "preferred_date_format": preferred_date_format,
        }
        record = FileUpload(
            id=file_uuid,
            original_filename=filename[:255],
            file_size_bytes=file_size_bytes,
            file_hash_sha256=file_hash,
            file_format=ext.lstrip("."),
            status="pending",
            metadata_json=metadata,
        )
        db.add(record)
        await db.commit()

    logger.info(
        "Upload salvo",
        extra={
            "file_uuid": str(file_uuid),
            "filename": filename,
            "size_bytes": file_size_bytes,
            "file_hash": file_hash,
            "status": "pending",
        },
    )

    return UploadResponse(
        file_uuid=str(file_uuid),
        original_filename=filename,
        file_size_bytes=file_size_bytes,
        status="pending",
        message="Arquivo recebido com sucesso e aguardando processamento.",
        strict_mode=strict_mode,
    )


@router.get("/{file_uuid}/status")
async def get_processing_status(file_uuid: str, db: AsyncSession = Depends(get_db)):
    """Retorna status atual do processamento."""
    try:
        parsed_uuid = uuid.UUID(file_uuid)
    except ValueError as exc:
        raise ValidationException("UUID invalido", error_code="INVALID_UUID", status_code=400) from exc

    file_record = await db.get(FileUpload, parsed_uuid)
    if file_record is None:
        raise ValidationException("Arquivo nao encontrado", error_code="FILE_NOT_FOUND", status_code=404)

    return {
        "file_uuid": file_uuid,
        "status": file_record.status,
        "progress": 0 if file_record.status == "pending" else 100,
        "message": "Aguardando processamento" if file_record.status == "pending" else "Processamento concluido",
    }
