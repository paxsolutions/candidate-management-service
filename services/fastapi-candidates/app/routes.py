"""Candidate API routes with search, sort, and pagination."""

from enum import Enum
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_api_key
from app.database import get_db
from app.models import Candidate
from app.schemas import CandidateOut, PaginatedCandidates

router = APIRouter(
    prefix="/external",
    dependencies=[Depends(require_api_key)],
)


class SortField(str, Enum):
    """Allowed sort columns for candidate listing."""

    first_name = "first_name"
    last_name = "last_name"
    email = "email"
    state = "state"
    id = "id"
    favourite = "favourite"
    create_time = "create_time"


# Searchable columns — used for multi-word ILIKE filtering
SEARCH_COLUMNS = [
    Candidate.favourite,
    Candidate.first_name,
    Candidate.last_name,
    Candidate.email,
    Candidate.state,
]


@router.get("/candidates", response_model=PaginatedCandidates)
async def list_candidates(
    search: str = Query(
        "",
        description="Space-separated search terms (matches across all text fields)",
    ),
    sort: SortField = Query(SortField.first_name, description="Column to sort by"),
    order: Literal["ASC", "DESC"] = Query("ASC"),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List candidates with search, sort, and pagination.

    **Search behaviour** mirrors the Node.js service:
    - Multiple search terms are split by whitespace.
    - ALL terms must match (AND logic).
    - Each term can match ANY of: first_name, last_name,
      email, state (OR within a term).
    - Matching is case-insensitive and supports partial/substring matches.

    **Query optimization:**
    - GIN trigram indexes on text columns accelerate ILIKE '%term%' searches.
    - B-tree indexes on sort columns support efficient ORDER BY + LIMIT/OFFSET.
    - The count query and the data query share the same WHERE clause; Postgres
      can reuse the filtered set when both run in the same transaction.
    """
    # Build WHERE clause: each search term must appear in at least one column
    terms = search.strip().split() if search.strip() else []
    filters = []
    for term in terms:
        pattern = f"%{term}%"
        term_filter = or_(*(col.ilike(pattern) for col in SEARCH_COLUMNS))
        filters.append(term_filter)

    # Total count (filtered)
    count_stmt = select(func.count()).select_from(Candidate)
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    # Data query with sort + pagination
    sort_col = getattr(Candidate, sort.value)
    order_clause = sort_col.desc() if order == "DESC" else sort_col.asc()

    data_stmt = (
        (
            select(Candidate)
            .where(*filters)
            .order_by(order_clause)
            .offset((page - 1) * limit)
            .limit(limit)
        )
        if filters
        else (
            select(Candidate)
            .order_by(order_clause)
            .offset((page - 1) * limit)
            .limit(limit)
        )
    )

    rows = (await db.execute(data_stmt)).scalars().all()

    return PaginatedCandidates(
        data=[CandidateOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        limit=limit,
        pages=max(1, -(-total // limit)),  # ceil division
    )


@router.get("/candidates/{candidate_id}", response_model=CandidateOut)
async def get_candidate(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a single candidate by ID."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return CandidateOut.model_validate(candidate)
