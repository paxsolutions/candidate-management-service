import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Candidate

# ── Helpers ──────────────────────────────────────────────────────────


async def seed_candidates(db: AsyncSession, count: int = 5) -> list[Candidate]:
    """Insert sample candidates and return them."""
    candidates = [
        Candidate(
            id=i,
            first_name=f"First{i}",
            last_name=f"Last{i}",
            email=f"user{i}@example.com",
            phone_number=f"555-000{i}",
            state="California" if i % 2 == 0 else "New York",
        )
        for i in range(1, count + 1)
    ]
    db.add_all(candidates)
    await db.commit()
    return candidates


# ── Health ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"


# ── List candidates ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_candidates_empty(client: AsyncClient):
    resp = await client.get("/external/candidates")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"] == []
    assert body["total"] == 0
    assert body["page"] == 1
    assert body["pages"] == 1


@pytest.mark.asyncio
async def test_list_candidates_returns_data(
    client: AsyncClient, db_session: AsyncSession
):
    await seed_candidates(db_session, 3)
    resp = await client.get("/external/candidates")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert len(body["data"]) == 3
    # Default sort is first_name ASC
    names = [c["first_name"] for c in body["data"]]
    assert names == sorted(names)


@pytest.mark.asyncio
async def test_list_candidates_response_shape(
    client: AsyncClient, db_session: AsyncSession
):
    await seed_candidates(db_session, 1)
    resp = await client.get("/external/candidates")
    candidate = resp.json()["data"][0]
    expected_keys = {"id", "first_name", "last_name", "email", "phone_number", "state"}
    assert set(candidate.keys()) == expected_keys


# ── Pagination ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pagination(client: AsyncClient, db_session: AsyncSession):
    await seed_candidates(db_session, 10)
    resp = await client.get("/external/candidates", params={"limit": 3, "page": 1})
    body = resp.json()
    assert body["total"] == 10
    assert body["limit"] == 3
    assert body["page"] == 1
    assert body["pages"] == 4  # ceil(10/3)
    assert len(body["data"]) == 3


@pytest.mark.asyncio
async def test_pagination_page_2(client: AsyncClient, db_session: AsyncSession):
    await seed_candidates(db_session, 5)
    page1 = (
        await client.get("/external/candidates", params={"limit": 2, "page": 1})
    ).json()
    page2 = (
        await client.get("/external/candidates", params={"limit": 2, "page": 2})
    ).json()
    ids_page1 = {c["id"] for c in page1["data"]}
    ids_page2 = {c["id"] for c in page2["data"]}
    assert ids_page1.isdisjoint(ids_page2), "Pages should not overlap"


# ── Sorting ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sort_desc(client: AsyncClient, db_session: AsyncSession):
    await seed_candidates(db_session, 5)
    resp = await client.get(
        "/external/candidates", params={"sort": "first_name", "order": "DESC"}
    )
    names = [c["first_name"] for c in resp.json()["data"]]
    assert names == sorted(names, reverse=True)


@pytest.mark.asyncio
async def test_sort_by_email(client: AsyncClient, db_session: AsyncSession):
    await seed_candidates(db_session, 5)
    resp = await client.get("/external/candidates", params={"sort": "email"})
    emails = [c["email"] for c in resp.json()["data"]]
    assert emails == sorted(emails)


# ── Search ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_single_term(client: AsyncClient, db_session: AsyncSession):
    await seed_candidates(db_session, 5)
    resp = await client.get("/external/candidates", params={"search": "First1"})
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["first_name"] == "First1"


@pytest.mark.asyncio
async def test_search_case_insensitive(client: AsyncClient, db_session: AsyncSession):
    await seed_candidates(db_session, 5)
    resp = await client.get("/external/candidates", params={"search": "first1"})
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_search_partial_match(client: AsyncClient, db_session: AsyncSession):
    await seed_candidates(db_session, 5)
    # "irst" should match "First1" through "First5"
    resp = await client.get("/external/candidates", params={"search": "irst"})
    assert resp.json()["total"] == 5


@pytest.mark.asyncio
async def test_search_multi_word_and_logic(
    client: AsyncClient, db_session: AsyncSession
):
    await seed_candidates(db_session, 5)
    # "First1 California" — First1 is id=1 which has state "New York", not California
    resp = await client.get(
        "/external/candidates", params={"search": "First2 California"}
    )
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["first_name"] == "First2"


@pytest.mark.asyncio
async def test_search_no_results(client: AsyncClient, db_session: AsyncSession):
    await seed_candidates(db_session, 5)
    resp = await client.get("/external/candidates", params={"search": "nonexistent"})
    assert resp.json()["total"] == 0


# ── Get single candidate ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_candidate_by_id(client: AsyncClient, db_session: AsyncSession):
    await seed_candidates(db_session, 3)
    resp = await client.get("/external/candidates/2")
    assert resp.status_code == 200
    assert resp.json()["id"] == 2
    assert resp.json()["first_name"] == "First2"


@pytest.mark.asyncio
async def test_get_candidate_not_found(client: AsyncClient, db_session: AsyncSession):
    resp = await client.get("/external/candidates/999")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Candidate not found"


# ── Auth (without override) ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_missing_api_key():
    """Without the dependency override, requests should fail auth."""
    from httpx import ASGITransport
    from httpx import AsyncClient as AC

    from app.main import app as real_app

    real_app.dependency_overrides.clear()
    transport = ASGITransport(app=real_app)
    async with AC(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/external/candidates")
        assert resp.status_code in (401, 403)
