"""Pydantic response schemas for candidate endpoints."""

from datetime import datetime

from pydantic import BaseModel


class CandidateOut(BaseModel):
    """Public candidate fields returned by the API."""

    id: int
    first_name: str
    last_name: str
    email: str
    phone_number: str
    state: str

    model_config = {"from_attributes": True}


class PaginatedCandidates(BaseModel):
    """Paginated list response with metadata."""

    data: list[CandidateOut]
    total: int
    page: int
    limit: int
    pages: int


class CandidateFull(BaseModel):
    """Full candidate record returned by internal API."""

    id: int
    first_name: str
    last_name: str
    email: str
    phone_number: str
    state: str
    favourite: str
    create_time: datetime
    notes: str
    upload_file: str
    upload_photo: str

    model_config = {"from_attributes": True}


class PaginatedCandidatesFull(BaseModel):
    """Paginated full-candidate list for internal API."""

    data: list[CandidateFull]
    total: int
