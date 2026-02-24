# PAX Access App — Candidate Management Platform

A full-stack candidate management application built with **Node.js/Express** and **React/TypeScript**, featuring Google OAuth authentication, advanced search, file management via AWS S3 pre-signed URLs, and a production deployment on AWS using Infrastructure as Code (CDK).

> **Note:** See the [Backend Highlights](#backend-highlights) section for a summary of key engineering decisions.

---

## Table of Contents

- [Overview](#overview)
- [Backend Highlights](#backend-highlights)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [API Reference](#api-reference)
- [Getting Started (Local Development)](#getting-started-local-development)
- [Project Structure](#project-structure)
- [Production Deployment](#production-deployment)
- [License](#license)

---

## Overview

PAX Access App is an internal tool for managing candidate records. Users authenticate via Google OAuth, then browse, search, and view detailed candidate profiles. The application supports:

- **Searchable candidate table** with server-side pagination and column sorting
- **Detailed candidate profiles** with notes, file downloads (S3 pre-signed URLs), and rich field rendering
- **Google OAuth 2.0** login with session persistence and token-based fallback
- **External API** with API-key authentication for third-party integrations (limited field exposure)
- **Dual database support** — MySQL for local development, DynamoDB for production (Lambda)
- **Dark mode** UI with responsive Tailwind CSS design

---

## Backend Highlights

These are the key backend/API patterns demonstrated in this project:

### 1. Authentication & Session Management

- **Google OAuth 2.0** via Passport.js (`backend/config/passport.js`, `backend/routes/auth.js`)
- Session store strategy: **MySQL-backed sessions** in production (ECS), **in-memory** for Lambda (ephemeral)
- Token-based fallback: after OAuth callback, a Base64 token is generated and passed via URL query param so the frontend can persist auth state in `localStorage` even if cookies fail across domains
- 24-hour token/session expiry with automatic cleanup

### 2. Advanced Search API

- **Multi-term AND search** — query `"john app"` requires both terms to match (can span different fields)
- **Case-insensitive partial matching** using `LOWER()` + `LIKE '%term%'` in MySQL; equivalent in-memory filtering for DynamoDB
- Covers fields: `favourite`, `first_name`, `last_name`, `email`, `state`
- Server-side pagination with `LIMIT`/`OFFSET` and total count

### 3. Dual Database Strategy

- **Local development** (`server.js`): Direct MySQL queries via `mysql2` connection pool
- **Production / Lambda** (`server-export.js`): DynamoDB via AWS SDK v3 (`@aws-sdk/lib-dynamodb`)
- Same API contract, different data layer — the Express routes are identical from the consumer's perspective

### 4. Secure File Access with S3 Pre-Signed URLs

- Files (documents, photos) are stored in S3 and never exposed directly
- The `/api/files/presigned-url` endpoint generates time-limited (1 hour) download URLs using `@aws-sdk/s3-request-presigner`

### 5. External API with API Key Auth

- `/external/candidates` routes use `X-API-Key` header authentication (`backend/middleware/apiKeyAuth.js`)
- Returns a **restricted field set** (id, first_name, last_name, email, phone_number, state) — no internal notes or files exposed
- Separate from the session-based internal API

### 6. Infrastructure as Code

- Full AWS CDK stack (`infrastructure/lib/candidate-app-stack.ts`) deploying:
  - VPC with public/private/isolated subnets
  - Lambda function behind ALB with HTTPS
  - CloudFront distribution serving React frontend from S3
  - DynamoDB table, Secrets Manager, Route 53 DNS, ACM certificates
- Lambda wrapping Express via `@vendia/serverless-express`

---

## Architecture

### Local Development

```
Browser → React (localhost:3000) → Express API (localhost:5001) → MySQL (Docker)
                                                                → S3 (AWS)
```

### Production (AWS)

```
Browser → CloudFront → S3 (React static site)
                    ↘ ALB → Lambda (Express via serverless-express) → DynamoDB
                                                                    → S3
                                                                    → Secrets Manager
```

---

## Tech Stack

| Layer            | Technology                                                   |
| ---------------- | ------------------------------------------------------------ |
| **Frontend**     | React 19, TypeScript, Tailwind CSS, React Router v5, Axios   |
| **Backend**      | Node.js 18, Express 4, Passport.js (Google OAuth 2.0)        |
| **Database**     | MySQL 8.0 (local), DynamoDB (production)                     |
| **File Storage** | AWS S3 with pre-signed URLs                                  |
| **Auth**         | Google OAuth 2.0, express-session, API key (external routes) |
| **Infra**        | AWS CDK (TypeScript), Lambda, ALB, CloudFront, VPC, Route 53 |
| **DevOps**       | Docker, Docker Compose, Adminer (DB GUI)                     |

---

## API Reference

All internal API routes require session authentication (Google OAuth). External routes require an `X-API-Key` header.

### Authentication

| Method | Endpoint                | Description                                       |
| ------ | ----------------------- | ------------------------------------------------- |
| GET    | `/auth/google`          | Initiates Google OAuth login flow                 |
| GET    | `/auth/google/callback` | OAuth callback — redirects to frontend with token |
| GET    | `/auth/logout`          | Logs out and redirects to frontend                |
| POST   | `/auth/validate_token`  | Validates a Base64 auth token                     |
| GET    | `/auth/current_user`    | Returns the currently authenticated user          |

### Candidates (Internal — Session Auth)

| Method | Endpoint              | Description                                   |
| ------ | --------------------- | --------------------------------------------- |
| GET    | `/api/candidates`     | List candidates with search, sort, pagination |
| GET    | `/api/candidates/:id` | Get a single candidate by ID                  |

**Query parameters for `/api/candidates`:**

| Param    | Default         | Description                                         |
| -------- | --------------- | --------------------------------------------------- |
| `search` | `""`            | Multi-word search string (AND logic, partial match) |
| `sort`   | `"create_time"` | Column to sort by                                   |
| `order`  | `"desc"`        | Sort direction: `asc` or `desc`                     |
| `page`   | `1`             | Page number                                         |
| `limit`  | `100`           | Results per page                                    |

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "first_name": "Jane",
      "last_name": "Doe",
      "email": "jane@example.com",
      "favourite": "yes",
      "state": "active",
      "create_time": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 245
}
```

### Files

| Method | Endpoint                   | Description                             |
| ------ | -------------------------- | --------------------------------------- |
| GET    | `/api/files/presigned-url` | Generate a time-limited S3 download URL |

**Query parameters:** `key` (required) — the S3 object key.

### External API (API Key Auth)

Include `X-API-Key: <your-api-key>` header with all requests.

| Method | Endpoint                   | Description                                             |
| ------ | -------------------------- | ------------------------------------------------------- |
| GET    | `/external/candidates`     | List candidates (limited fields) with search/pagination |
| GET    | `/external/candidates/:id` | Get single candidate (limited fields)                   |

**Returned fields (restricted):** `id`, `first_name`, `last_name`, `email`, `phone_number`, `state`

### Health

| Method | Endpoint               | Description                             |
| ------ | ---------------------- | --------------------------------------- |
| GET    | `/api/health`          | Basic health check (no auth required)   |
| GET    | `/api/health/detailed` | Detailed health with memory/uptime info |

---

## Getting Started (Local Development)

### Prerequisites

- **Docker** and **Docker Compose** installed and running
- **Google OAuth credentials** (Client ID and Client Secret) — see [Google OAuth Setup](#google-oauth-setup)
- **AWS credentials** (for S3 file downloads — optional, app works without it)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd candidate-management-service
```

### 2. Configure Environment Variables

Copy the template and fill in your values:

```bash
cp .env.new-account-template .env.development
```

Edit `.env.development`:

```bash
# Database (defaults work with docker-compose)
DB_HOST=db
DB_USER=pax_user
DB_PASSWORD=pax_password
DB_NAME=pax_local
DB_TABLE_NAME=candidates
DB_PORT=3306

# Google OAuth (required for login)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Session
SESSION_SECRET=any-random-string-here

# Frontend
FRONTEND_URL=http://localhost:3000

# AWS (optional — only needed for file downloads)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your_bucket_name
```

### 3. Seed the Database (Optional)

If you have a `database.sql` dump, place it in the `data/` directory. MySQL will automatically import any `.sql` files from `data/` on first startup:

```bash
mkdir -p data
cp database.sql data/
```

> **Note:** The `data/` directory and `database.sql` are gitignored. You'll need to provide your own data or start with an empty database.

### 4. Start the Application

**Development mode** (with hot reload):

```bash
docker compose -f docker-compose.dev.yml up --build
```

**Standard mode:**

```bash
docker compose up --build
```

### 5. Access the Application

| Service              | URL                              |
| -------------------- | -------------------------------- |
| **Frontend**         | http://localhost:3000            |
| **Backend API**      | http://localhost:5001            |
| **Adminer** (DB GUI) | http://localhost:8080            |
| **Health Check**     | http://localhost:5001/api/health |

To log into Adminer, use:

- **System:** MySQL
- **Server:** `db`
- **Username:** `pax_user`
- **Password:** `pax_password`
- **Database:** `pax_local`

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Set **Application type** to "Web application"
6. Add **Authorized redirect URIs:**
   - `http://localhost:5001/auth/google/callback`
7. Copy the Client ID and Client Secret into your `.env.development` file

---

## Project Structure

```
candidate-management-service/
├── backend/
│   ├── config/
│   │   └── passport.js            # Google OAuth strategy configuration
│   ├── db/
│   │   └── dynamodb.js            # DynamoDB client (production data layer)
│   ├── middleware/
│   │   └── apiKeyAuth.js          # API key authentication middleware
│   ├── routes/
│   │   ├── auth.js                # OAuth login/logout/token routes
│   │   ├── external.js            # External API (restricted fields, API key auth)
│   │   └── health.js              # Health check endpoints
│   ├── server.js                  # Express app for local dev (MySQL)
│   ├── server-export.js           # Express app for Lambda (DynamoDB, no .listen())
│   ├── lambda.js                  # AWS Lambda handler (wraps Express)
│   ├── Dockerfile                 # Production Docker image
│   └── Dockerfile.dev             # Dev Docker image (with nodemon)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Table.tsx          # Searchable, sortable candidate table
│   │   │   └── CandidateProfile.tsx  # Detailed candidate view with file downloads
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx     # React auth context (OAuth + localStorage)
│   │   ├── api.ts                 # Axios API client with auth interceptor
│   │   └── App.tsx                # Routes and layout (private routes, dark mode)
│   ├── Dockerfile                 # Production build (Nginx)
│   └── Dockerfile.dev             # Dev server (CRA with hot reload)
│
├── infrastructure/
│   └── lib/
│       └── candidate-app-stack.ts # AWS CDK stack (VPC, Lambda, ALB, CloudFront, DynamoDB)
│
├── scripts/                       # Deployment and operations scripts
├── docker-compose.yml             # Standard Docker setup
├── docker-compose.dev.yml         # Dev setup with hot reload and volume mounts
└── .env.new-account-template      # Environment variable template
```

---

## Production Deployment

The production stack is deployed to AWS using CDK. See [README-DEPLOYMENT.md](./README-DEPLOYMENT.md) for full deployment instructions.

**Key infrastructure components:**

- **Lambda** (Node.js 22) running the Express backend via `@vendia/serverless-express`
- **Application Load Balancer** with HTTPS (ACM certificate) routing `/api/*`, `/auth/*`, `/external/*` to Lambda
- **CloudFront** distribution serving the React frontend from S3, with API paths forwarded to ALB
- **DynamoDB** (on-demand billing, pay-per-request)
- **S3** for candidate file storage (documents, photos)
- **Secrets Manager** for credentials
- **Route 53** for DNS with custom domain

---

## License

This project is proprietary. All rights reserved.
