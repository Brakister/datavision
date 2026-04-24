"""Modelos SQLAlchemy da aplicacao."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
	"""Base declarativa para metadados do SQLAlchemy."""


class FileUpload(Base):
	"""Arquivo enviado pelo usuario e estado do processamento."""

	__tablename__ = "file_uploads"

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
	file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
	file_hash_sha256: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
	file_format: Mapped[str] = mapped_column(String(16), nullable=False)
	status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
	metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True),
		nullable=False,
		server_default=func.now(),
		onupdate=func.now(),
	)


class DashboardLayout(Base):
	"""Layout salvo do dashboard por arquivo."""

	__tablename__ = "dashboard_layouts"

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	file_upload_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("file_uploads.id", ondelete="CASCADE"),
		nullable=False,
		index=True,
	)
	name: Mapped[str] = mapped_column(String(120), nullable=False, default="default")
	layout_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True),
		nullable=False,
		server_default=func.now(),
		onupdate=func.now(),
	)


class AuditLog(Base):
	"""Registro auditavel de eventos do sistema."""

	__tablename__ = "audit_logs"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
	file_upload_id: Mapped[uuid.UUID | None] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("file_uploads.id", ondelete="SET NULL"),
		nullable=True,
		index=True,
	)
	event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
	detail: Mapped[str] = mapped_column(Text, nullable=False)
	context_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


__all__ = ["Base", "FileUpload", "DashboardLayout", "AuditLog"]
