"""initial core tables

Revision ID: 20260424_0001
Revises: 
Create Date: 2026-04-24 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260424_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "file_uploads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("file_hash_sha256", sa.String(length=64), nullable=False),
        sa.Column("file_format", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_file_uploads_file_hash_sha256", "file_uploads", ["file_hash_sha256"], unique=True)
    op.create_index("ix_file_uploads_status", "file_uploads", ["status"], unique=False)

    op.create_table(
        "dashboard_layouts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_upload_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False, server_default="default"),
        sa.Column("layout_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["file_upload_id"], ["file_uploads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dashboard_layouts_file_upload_id", "dashboard_layouts", ["file_upload_id"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("file_upload_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("context_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["file_upload_id"], ["file_uploads.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_event_type", "audit_logs", ["event_type"], unique=False)
    op.create_index("ix_audit_logs_file_upload_id", "audit_logs", ["file_upload_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_logs_file_upload_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_event_type", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_dashboard_layouts_file_upload_id", table_name="dashboard_layouts")
    op.drop_table("dashboard_layouts")

    op.drop_index("ix_file_uploads_status", table_name="file_uploads")
    op.drop_index("ix_file_uploads_file_hash_sha256", table_name="file_uploads")
    op.drop_table("file_uploads")
