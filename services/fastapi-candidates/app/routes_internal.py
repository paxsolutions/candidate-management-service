"""Internal API routes matching the Node.js /api/* contract.

These routes serve the React frontend directly. In production the
Node.js backend handles Google OAuth sessions; here we provide a
dev-mode bypass so the frontend can render without a real OAuth flow.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Candidate
from app.schemas import CandidateFull, PaginatedCandidatesFull

internal_router = APIRouter()

# Columns searched by the multi-word ILIKE filter (matches Node.js)
_SEARCH_COLS = [
    Candidate.favourite,
    Candidate.first_name,
    Candidate.last_name,
    Candidate.email,
    Candidate.state,
]


# ── Auth stubs (dev mode) ───────────────────────────────────────────


@internal_router.get("/auth/validate-token")
async def validate_token():
    """Return a fake authenticated user for local development."""
    return {
        "user": {
            "id": 1,
            "displayName": "Dev User",
            "emails": [{"value": "dev@localhost"}],
        }
    }


@internal_router.get("/auth/google")
async def google_login():
    """Stub: redirect not needed in dev mode."""
    return {"message": "OAuth disabled in FastAPI dev mode"}


@internal_router.post("/auth/logout")
async def logout():
    """Stub: clear session (no-op in dev mode)."""
    return {"message": "Logged out"}


@internal_router.get("/api/me")
async def me():
    """Return a fake user profile for the frontend."""
    return {
        "id": 1,
        "displayName": "Dev User",
        "emails": [{"value": "dev@localhost"}],
    }


# ── Candidates (internal, all fields) ───────────────────────────────


@internal_router.get(
    "/api/candidates",
    response_model=PaginatedCandidatesFull,
)
async def list_candidates_internal(
    search: str = Query(""),
    sort: str = Query("create_time"),
    order: Literal["asc", "desc", "ASC", "DESC"] = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all candidate fields with search, sort, and pagination.

    Mirrors the Node.js GET /api/candidates endpoint used by the
    React frontend.
    """
    terms = search.strip().split() if search.strip() else []
    filters = []
    for term in terms:
        pattern = f"%{term}%"
        term_filter = or_(*(col.ilike(pattern) for col in _SEARCH_COLS))
        filters.append(term_filter)

    count_stmt = select(func.count()).select_from(Candidate)
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    sort_col = getattr(Candidate, sort, Candidate.create_time)
    order_clause = sort_col.desc() if order.upper() == "DESC" else sort_col.asc()

    base = select(Candidate)
    if filters:
        base = base.where(*filters)
    data_stmt = base.order_by(order_clause).offset((page - 1) * limit).limit(limit)

    rows = (await db.execute(data_stmt)).scalars().all()

    return PaginatedCandidatesFull(
        data=[CandidateFull.model_validate(r) for r in rows],
        total=total,
    )


@internal_router.get(
    "/api/candidates/{candidate_id}",
    response_model=CandidateFull,
)
async def get_candidate_internal(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a single candidate with all fields."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return CandidateFull.model_validate(candidate)


# ── File stub ────────────────────────────────────────────────────────


@internal_router.get("/api/files/presigned-url")
async def presigned_url(key: str = Query(...)):
    """Stub: return a placeholder URL (no real S3 in dev)."""
    return {"url": f"https://placeholder.example.com/{key}"}


# ── Health (matches Node.js path) ────────────────────────────────────


@internal_router.get("/api/health")
async def api_health():
    """Health check at the /api path the frontend expects."""
    return {"status": "ok"}
