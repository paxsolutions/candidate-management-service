"""API key authentication dependency."""

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

from app.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str | None = Security(api_key_header)) -> str:
    """Validate the X-API-Key header against the configured key."""
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")

    if not settings.external_api_key:
        raise HTTPException(status_code=500, detail="API key validation not configured")

    if api_key != settings.external_api_key:
        raise HTTPException(status_code=403, detail="Invalid API key")

    return api_key
