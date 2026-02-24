"""Add favourite, create_time, notes, upload_file, upload_photo columns.

Revision ID: 002
Revises: 001
Create Date: 2025-01-02 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "candidates",
        sa.Column("favourite", sa.String(255), server_default=""),
    )
    op.add_column(
        "candidates",
        sa.Column(
            "create_time",
            sa.DateTime(),
            server_default=sa.text("now()"),
        ),
    )
    op.add_column(
        "candidates",
        sa.Column("notes", sa.Text(), server_default=""),
    )
    op.add_column(
        "candidates",
        sa.Column("upload_file", sa.String(500), server_default=""),
    )
    op.add_column(
        "candidates",
        sa.Column("upload_photo", sa.String(500), server_default=""),
    )

    # B-tree indexes for sort columns
    op.create_index("ix_candidates_favourite", "candidates", ["favourite"])
    op.create_index("ix_candidates_create_time", "candidates", ["create_time"])

    # GIN trigram index on favourite for ILIKE search
    op.execute(
        "CREATE INDEX ix_candidates_favourite_trgm "
        "ON candidates USING gin (favourite gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_candidates_favourite_trgm")
    op.drop_index("ix_candidates_create_time", "candidates")
    op.drop_index("ix_candidates_favourite", "candidates")
    op.drop_column("candidates", "upload_photo")
    op.drop_column("candidates", "upload_file")
    op.drop_column("candidates", "notes")
    op.drop_column("candidates", "create_time")
    op.drop_column("candidates", "favourite")
