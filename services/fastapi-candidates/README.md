# FastAPI Candidates Service

A Python FastAPI service that implements the same `/external/candidates` API contract as the Node.js backend, backed by PostgreSQL with Alembic migrations.

## Key Features

- **Same API contract** as the Node.js `/external/candidates` endpoints
- **PostgreSQL** with async SQLAlchemy (asyncpg driver)
- **Alembic migrations** with query-optimized indexes
- **API key authentication** via `X-API-Key` header
- **Multi-word search** — case-insensitive, partial match, AND logic across terms
- **GIN trigram indexes** for fast `ILIKE '%term%'` substring searches
- **B-tree indexes** on sort columns for efficient `ORDER BY` + pagination
- **pytest** test suite with async test client
- **GitHub Actions CI** with Postgres service container

## Query Optimization

The migration creates two types of indexes on searchable/sortable columns:

| Index Type                  | Purpose                                | Columns                                                                 |
| --------------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| **B-tree**                  | `ORDER BY` + `LIMIT/OFFSET` pagination | `first_name`, `last_name`, `email`, `state`, `favourite`, `create_time` |
| **GIN trigram** (`pg_trgm`) | `ILIKE '%term%'` substring search      | `first_name`, `last_name`, `email`, `state`, `favourite`                |

Without GIN trigram indexes, every `ILIKE '%term%'` query would require a sequential scan of the entire table. The `pg_trgm` extension splits strings into 3-character grams and builds an inverted index, turning these into index scans.

## API Endpoints

### `GET /external/candidates`

List candidates with search, sort, and pagination.

| Param    | Type   | Default      | Description                                       |
| -------- | ------ | ------------ | ------------------------------------------------- |
| `search` | string | `""`         | Space-separated search terms (AND logic)          |
| `sort`   | enum   | `first_name` | `id`, `first_name`, `last_name`, `email`, `state` |
| `order`  | enum   | `ASC`        | `ASC` or `DESC`                                   |
| `page`   | int    | `1`          | Page number (1-indexed)                           |
| `limit`  | int    | `100`        | Results per page (max 500)                        |

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "first_name": "...",
      "last_name": "...",
      "email": "...",
      "phone_number": "...",
      "state": "..."
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 100,
  "pages": 1
}
```

### `GET /external/candidates/{id}`

Get a single candidate by ID.

### `GET /health`

Health check (no auth required).

### Internal routes (for React frontend)

These mirror the Node.js `/api/*` contract so the React frontend works as-is:

| Route                          | Description                                              |
| ------------------------------ | -------------------------------------------------------- |
| `GET /api/candidates`          | List candidates (all fields, same query params as above) |
| `GET /api/candidates/{id}`     | Single candidate (all fields)                            |
| `GET /auth/validate-token`     | Returns a stub dev user (bypasses Google OAuth)          |
| `GET /api/me`                  | Stub user profile                                        |
| `POST /auth/logout`            | No-op stub                                               |
| `GET /api/files/presigned-url` | Returns placeholder URL (no real S3)                     |
| `GET /api/health`              | Health check at the `/api` path                          |

## Quick Start

### Full-Stack with React Frontend

```bash
# 1. Start Postgres + FastAPI via Docker Compose
cd services/fastapi-candidates
docker compose up -d

# 2. Seed sample data (50 candidates)
uv run python -m scripts.seed

# 3. Start the React frontend (in another terminal)
cd frontend
REACT_APP_API_URL=http://localhost:8000 npm start

# Frontend: http://localhost:3000
# FastAPI docs: http://localhost:8000/docs
```

The frontend will connect to FastAPI instead of the Node.js backend.
Auth is bypassed (auto-authenticated as "Dev User"), and file
downloads return placeholder URLs.

### With Docker Compose (API only)

```bash
cd services/fastapi-candidates
docker compose up
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### Local Development

```bash
cd services/fastapi-candidates

# Install dependencies (requires uv: https://docs.astral.sh/uv/)
uv sync --extra dev

# Copy env and configure
cp .env.example .env

# Run migrations (requires a running Postgres instance)
uv run alembic upgrade head

# Start dev server
uv run uvicorn app.main:app --reload --port 8000
```

### Run Tests

```bash
# Tests use an in-memory SQLite database — no Postgres required
uv run pytest -v

# With coverage
uv run pytest --cov=app --cov-report=term-missing -v
```

## Project Structure

```
services/fastapi-candidates/
├── app/
│   ├── __init__.py
│   ├── auth.py          # API key authentication dependency
│   ├── config.py        # Pydantic settings (env vars)
│   ├── database.py      # Async SQLAlchemy engine + session
│   ├── main.py          # FastAPI app entrypoint
│   ├── models.py        # SQLAlchemy ORM model + index definitions
│   ├── routes.py        # /external/candidates endpoints (API key auth)
│   ├── routes_internal.py  # /api/* endpoints (frontend compat + auth stubs)
│   └── schemas.py       # Pydantic response models
├── alembic/
│   ├── env.py           # Async Alembic environment
│   ├── script.py.mako   # Migration template
│   └── versions/
│       ├── 001_create_candidates_table.py  # Initial migration + GIN indexes
│       └── 002_add_full_candidate_columns.py  # favourite, create_time, notes, etc.
├── tests/
│   ├── conftest.py      # Fixtures (SQLite test DB, async client)
│   └── test_candidates.py  # 16 test cases
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml     # uv / PEP 621 project definition
├── uv.lock
├── scripts/
│   └── seed.py        # Seed database with sample candidates
├── .env.example
└── README.md
```

## CI/CD

The GitHub Actions workflow (`.github/workflows/fastapi-candidates.yml`) runs on pushes/PRs that touch `services/fastapi-candidates/**`:

1. **test** — Spins up a Postgres 16 service container, runs migrations, then `pytest --cov`
2. **lint** — Runs `ruff check` and `ruff format --check`
