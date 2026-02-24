"""Create candidates table with optimized indexes

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the candidates table
    op.create_table(
        "candidates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("first_name", sa.String(255), server_default=""),
        sa.Column("last_name", sa.String(255), server_default=""),
        sa.Column("email", sa.String(255), server_default=""),
        sa.Column("phone_number", sa.String(50), server_default=""),
        sa.Column("state", sa.String(100), server_default=""),
    )

    # ----------------------------------------------------------------
    # B-tree indexes — accelerate ORDER BY + LIMIT/OFFSET pagination
    # ----------------------------------------------------------------
    op.create_index("ix_candidates_first_name", "candidates", ["first_name"])
    op.create_index("ix_candidates_last_name", "candidates", ["last_name"])
    op.create_index("ix_candidates_email", "candidates", ["email"])
    op.create_index("ix_candidates_state", "candidates", ["state"])

    # ----------------------------------------------------------------
    # GIN trigram indexes — accelerate ILIKE '%term%' substring search
    #
    # pg_trgm splits strings into 3-character grams and builds an
    # inverted index.  This turns a full-table-scan ILIKE into an
    # index scan, which is critical for the multi-word search feature.
    #
    # Requires the pg_trgm extension (ships with PostgreSQL, just
    # needs to be enabled once per database).
    # ----------------------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX ix_candidates_first_name_trgm "
        "ON candidates USING gin (first_name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX ix_candidates_last_name_trgm "
        "ON candidates USING gin (last_name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX ix_candidates_email_trgm "
        "ON candidates USING gin (email gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX ix_candidates_state_trgm "
        "ON candidates USING gin (state gin_trgm_ops)"
    )


def downgrade() -> None:
    op.drop_index("ix_candidates_state_trgm", "candidates")
    op.drop_index("ix_candidates_email_trgm", "candidates")
    op.drop_index("ix_candidates_last_name_trgm", "candidates")
    op.drop_index("ix_candidates_first_name_trgm", "candidates")
    op.drop_index("ix_candidates_state", "candidates")
    op.drop_index("ix_candidates_email", "candidates")
    op.drop_index("ix_candidates_last_name", "candidates")
    op.drop_index("ix_candidates_first_name", "candidates")
    op.drop_table("candidates")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
