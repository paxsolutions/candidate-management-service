const express = require("express");
const request = require("supertest");
const healthRoutes = require("../../routes/health");

function createApp() {
  const app = express();
  app.use("/api", healthRoutes);
  return app;
}

describe("GET /api/health", () => {
  it("should return 200 with healthy status", async () => {
    const app = createApp();
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.service).toBe("pax-backend");
    expect(res.body).toHaveProperty("timestamp");
  });
});

describe("GET /api/health/detailed", () => {
  it("should return 200 with detailed health info", async () => {
    const app = createApp();
    const res = await request(app).get("/api/health/detailed");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.checks).toHaveProperty("memory");
    expect(res.body.checks).toHaveProperty("uptime");
  });

  it("should report database as configured when DB_HOST is set", async () => {
    process.env.DB_HOST = "localhost";
    const app = createApp();
    const res = await request(app).get("/api/health/detailed");

    expect(res.body.checks.database).toBe("configured");
    delete process.env.DB_HOST;
  });

  it("should report database as not_configured when DB_HOST is missing", async () => {
    delete process.env.DB_HOST;
    const app = createApp();
    const res = await request(app).get("/api/health/detailed");

    expect(res.body.checks.database).toBe("not_configured");
  });
});
