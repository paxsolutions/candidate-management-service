"""SQLAlchemy ORM models for the candidates table."""

from datetime import UTC, datetime

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


class Candidate(Base):
    """Candidate record with indexed columns for search and pagination."""

    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(255), default="")
    last_name: Mapped[str] = mapped_column(String(255), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    phone_number: Mapped[str] = mapped_column(String(50), default="")
    state: Mapped[str] = mapped_column(String(100), default="")
    favourite: Mapped[str] = mapped_column(String(255), default="")
    create_time: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC)
    )
    notes: Mapped[str] = mapped_column(Text, default="")
    upload_file: Mapped[str] = mapped_column(String(500), default="")
    upload_photo: Mapped[str] = mapped_column(String(500), default="")

    # ------------------------------------------------------------------
    # Query optimization: indexes for search + sort + pagination
    #
    # 1. GIN trigram indexes on text columns enable fast ILIKE '%term%'
    #    searches without full table scans.  These are created in the
    #    Alembic migration via raw SQL (pg_trgm extension) because
    #    SQLAlchemy doesn't natively support GIN/trigram indexes.
    #
    # 2. B-tree indexes on sortable columns let ORDER BY … LIMIT/OFFSET
    #    use an index scan instead of sorting the whole table in memory.
    # ------------------------------------------------------------------
    __table_args__ = (
        # B-tree indexes for ORDER BY / pagination on common sort columns
        Index("ix_candidates_first_name", "first_name"),
        Index("ix_candidates_last_name", "last_name"),
        Index("ix_candidates_email", "email"),
        Index("ix_candidates_state", "state"),
        Index("ix_candidates_favourite", "favourite"),
        Index("ix_candidates_create_time", "create_time"),
    )
