const express = require("express");
const session = require("express-session");
const request = require("supertest");
const authRoutes = require("../../routes/auth");

// Mock passport to avoid requiring real Google OAuth credentials
jest.mock("../../config/passport", () => {
  const passport = require("passport");
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
  return passport;
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    }),
  );

  const passport = require("../../config/passport");
  app.use(passport.initialize());
  app.use(passport.session());

  app.use("/auth", authRoutes);
  return app;
}

describe("POST /auth/validate_token", () => {
  it("should return 400 when no token is provided", async () => {
    const app = createApp();
    const res = await request(app).post("/auth/validate_token").send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Token required");
  });

  it("should return 401 for an invalid (non-base64) token", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/auth/validate_token")
      .send({ token: "not-valid-json-base64!!!" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid token");
  });

  it("should return 401 for an expired token", async () => {
    const expiredToken = Buffer.from(
      JSON.stringify({
        id: "123",
        email: "test@example.com",
        name: "Test User",
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      }),
    ).toString("base64");

    const app = createApp();
    const res = await request(app)
      .post("/auth/validate_token")
      .send({ token: expiredToken });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token expired");
  });

  it("should return user data for a valid token", async () => {
    const validToken = Buffer.from(
      JSON.stringify({
        id: "123",
        email: "test@example.com",
        name: "Test User",
        timestamp: Date.now(),
      }),
    ).toString("base64");

    const app = createApp();
    const res = await request(app)
      .post("/auth/validate_token")
      .send({ token: validToken });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("123");
    expect(res.body.displayName).toBe("Test User");
    expect(res.body.emails[0].value).toBe("test@example.com");
  });
});

describe("GET /auth/current_user", () => {
  it("should return empty object when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/auth/current_user");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });
});

describe("GET /auth/logout", () => {
  it("should redirect to frontend URL", async () => {
    process.env.FRONTEND_URL = "http://localhost:3000";
    const app = createApp();
    const res = await request(app).get("/auth/logout");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("http://localhost:3000");
    delete process.env.FRONTEND_URL;
  });
});
