const request = require("supertest");

// Mock DynamoDB before requiring the app
jest.mock("../db/dynamodb", () => ({
  searchCandidates: jest.fn(),
  getCandidateById: jest.fn(),
}));

// Mock AWS S3
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  GetObjectCommand: jest.fn(),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

// Mock passport Google strategy to avoid requiring real OAuth credentials
jest.mock("passport-google-oauth20", () => ({
  Strategy: jest.fn().mockImplementation((opts, verify) => ({
    name: "google",
    authenticate: jest.fn(),
  })),
}));

// Set required env vars before loading app
process.env.SESSION_SECRET = "test-session-secret";
process.env.EXTERNAL_API_KEY = "test-api-key";
process.env.S3_BUCKET_NAME = "test-bucket";

const app = require("../server-export");
const { searchCandidates, getCandidateById } = require("../db/dynamodb");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Health ──────────────────────────────────────────────────────────

describe("GET /api/health (app-level)", () => {
  it("should return 200 with ok status", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body).toHaveProperty("timestamp");
  });
});

// ── Auth-gated routes ───────────────────────────────────────────────

describe("Authenticated /api/* routes", () => {
  it("should return 401 for /api/me when not authenticated", async () => {
    const res = await request(app).get("/api/me");

    expect(res.status).toBe(401);
  });

  it("should return 401 for /api/candidates when not authenticated", async () => {
    const res = await request(app).get("/api/candidates");

    expect(res.status).toBe(401);
  });

  it("should return 401 for /api/candidates/:id when not authenticated", async () => {
    const res = await request(app).get("/api/candidates/1");

    expect(res.status).toBe(401);
  });
});

// ── Pre-signed URL ──────────────────────────────────────────────────

describe("GET /api/files/presigned-url", () => {
  it("should return 401 when not authenticated", async () => {
    const res = await request(app).get("/api/files/presigned-url?key=test.pdf");

    expect(res.status).toBe(401);
  });
});

// ── External routes (via app) ───────────────────────────────────────

describe("External API routes via full app", () => {
  it("should require API key for /external/candidates", async () => {
    const res = await request(app).get("/external/candidates");

    expect(res.status).toBe(401);
  });

  it("should return candidates with valid API key", async () => {
    searchCandidates.mockResolvedValue({
      data: [
        {
          id: "1",
          first_name: "Alice",
          last_name: "Smith",
          email: "alice@example.com",
          phone_number: "555-0001",
          state: "CA",
        },
      ],
      total: 1,
    });

    const res = await request(app)
      .get("/external/candidates")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].first_name).toBe("Alice");
  });
});
