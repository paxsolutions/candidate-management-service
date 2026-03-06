const express = require("express");
const request = require("supertest");
const externalRoutes = require("../../routes/external");

// Mock the DynamoDB module
jest.mock("../../db/dynamodb", () => ({
  searchCandidates: jest.fn(),
  getCandidateById: jest.fn(),
}));

const { searchCandidates, getCandidateById } = require("../../db/dynamodb");

function createApp() {
  const app = express();
  app.use(express.json());
  // Set a valid API key for tests
  process.env.EXTERNAL_API_KEY = "test-api-key";
  app.use("/external", externalRoutes);
  return app;
}

const API_KEY_HEADER = { "x-api-key": "test-api-key" };

const sampleCandidates = [
  {
    id: "1",
    first_name: "Alice",
    last_name: "Smith",
    email: "alice@example.com",
    phone_number: "555-0001",
    state: "California",
    secret_field: "should-be-filtered",
  },
  {
    id: "2",
    first_name: "Bob",
    last_name: "Jones",
    email: "bob@example.com",
    phone_number: "555-0002",
    state: "New York",
    secret_field: "should-be-filtered",
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /external/candidates", () => {
  it("should require API key", async () => {
    const app = createApp();
    const res = await request(app).get("/external/candidates");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("API key required");
  });

  it("should reject invalid API key", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/external/candidates")
      .set("x-api-key", "wrong-key");

    expect(res.status).toBe(403);
  });

  it("should return paginated candidates with filtered fields", async () => {
    searchCandidates.mockResolvedValue({
      data: sampleCandidates,
      total: 2,
    });

    const app = createApp();
    const res = await request(app)
      .get("/external/candidates")
      .set(API_KEY_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body).toHaveProperty("pages");
    expect(res.body).toHaveProperty("limit");

    // Verify field filtering — secret_field should not appear
    const candidate = res.body.data[0];
    expect(candidate).toHaveProperty("id");
    expect(candidate).toHaveProperty("first_name");
    expect(candidate).toHaveProperty("last_name");
    expect(candidate).toHaveProperty("email");
    expect(candidate).toHaveProperty("phone_number");
    expect(candidate).toHaveProperty("state");
    expect(candidate).not.toHaveProperty("secret_field");
  });

  it("should pass query params to searchCandidates", async () => {
    searchCandidates.mockResolvedValue({ data: [], total: 0 });

    const app = createApp();
    await request(app)
      .get("/external/candidates?search=alice&sort=email&order=DESC&page=2&limit=10")
      .set(API_KEY_HEADER);

    expect(searchCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "alice",
        sort: "email",
        order: "DESC",
        limit: 10,
        offset: 10, // (page 2 - 1) * limit 10
      }),
    );
  });

  it("should return 500 when searchCandidates throws", async () => {
    searchCandidates.mockRejectedValue(new Error("DynamoDB error"));

    const app = createApp();
    const res = await request(app)
      .get("/external/candidates")
      .set(API_KEY_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch candidates data");
  });
});

describe("GET /external/candidates/:id", () => {
  it("should return a single candidate with filtered fields", async () => {
    getCandidateById.mockResolvedValue(sampleCandidates[0]);

    const app = createApp();
    const res = await request(app)
      .get("/external/candidates/1")
      .set(API_KEY_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("1");
    expect(res.body.first_name).toBe("Alice");
    expect(res.body).not.toHaveProperty("secret_field");
  });

  it("should return 404 when candidate is not found", async () => {
    getCandidateById.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .get("/external/candidates/999")
      .set(API_KEY_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Candidate not found");
  });

  it("should return 500 when getCandidateById throws", async () => {
    getCandidateById.mockRejectedValue(new Error("DynamoDB error"));

    const app = createApp();
    const res = await request(app)
      .get("/external/candidates/1")
      .set(API_KEY_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch candidate data");
  });
});
