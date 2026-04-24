from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.core.config import get_settings

settings = get_settings()


def record_path(file_uuid: str) -> Path:
    storage_root = Path(settings.STORAGE_PATH)
    return storage_root / file_uuid / "file_record.json"


def save_record(file_uuid: str, record: dict[str, Any]) -> None:
    path = record_path(file_uuid)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")


def load_record(file_uuid: str) -> dict[str, Any] | None:
    path = record_path(file_uuid)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))

