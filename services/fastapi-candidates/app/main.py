"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import router
from app.routes_internal import internal_router

app = FastAPI(
    title="Candidate Management API",
    description=(
        "FastAPI service implementing the "
        "/external/candidates contract with PostgreSQL."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(internal_router)


@app.get("/health")
async def health():
    """Return basic service health status."""
    return {"status": "ok", "service": "fastapi-candidates"}
