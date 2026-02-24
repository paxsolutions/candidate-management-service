// Exportable Express app for Lambda (without .listen())
const envFile =
  process.env.NODE_ENV === "production" ? "../.env" : "../.env.development";
require("dotenv").config({ path: envFile });

const express = require("express");
const session = require("express-session");
const passport = require("./config/passport");
const authRoutes = require("./routes/auth");
const healthRoutes = require("./routes/health");
const externalRoutes = require("./routes/external");
const cors = require("cors");

const { getCandidateById, searchCandidates } = require("./db/dynamodb");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const S3_BUCKET = process.env.S3_BUCKET_NAME;

const app = express();

// Trust proxy - required for Lambda behind ALB
app.set("trust proxy", 1);

// Use MemoryStore for sessions (Lambda has ephemeral storage)
// Note: Sessions will not persist across Lambda invocations, but this is acceptable
// for the use case since Google OAuth tokens are short-lived
let sessionStore;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

// Session configuration with MySQL store
const sessionConfig = {
  store: sessionStore, // Will be MySQL in production, MemoryStore in dev
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: "pax.session.id",
  proxy: true, // Trust first proxy (ALB)
  cookie: {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    domain:
      process.env.NODE_ENV === "production"
        ? process.env.COOKIE_DOMAIN || undefined
        : undefined,
  },
};

app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/auth", authRoutes);
app.use("/api", healthRoutes);

// External API routes (uses API key auth, not session auth)
app.use("/external", externalRoutes);

// Authentication middleware for all /api/* routes (except /api/health)
app.use("/api", (req, res, next) => {
  // Allow health check endpoint for ALB
  if (req.path === "/health") {
    return next();
  }

  // Require authentication for all other API routes
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }

  next();
});

// No MySQL connection needed - using DynamoDB

app.get("/api/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json(req.user);
});

// Get all candidates with pagination and search (using DynamoDB)
app.get("/api/candidates", async (req, res) => {
  try {
    const {
      search = "",
      sort = "create_time",
      order = "desc",
      page = 1,
      limit = 100,
    } = req.query;
    const offset = (page - 1) * limit;

    const result = await searchCandidates({
      search,
      sort,
      order,
      limit,
      offset,
    });

    res.json(result);
  } catch (error) {
    console.error("DynamoDB Query Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single candidate by ID (using DynamoDB)
app.get("/api/candidates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const candidate = await getCandidateById(id);

    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    res.json(candidate);
  } catch (error) {
    console.error("DynamoDB Query Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Generate pre-signed URL for S3 object
const generatePresignedUrl = async (key, expiresIn = 3600) => {
  if (!key) return null;

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  try {
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    return null;
  }
};

// Endpoint to get pre-signed URL for a file
app.get("/api/files/presigned-url", async (req, res) => {
  const { key } = req.query;

  if (!key) {
    return res.status(400).json({ error: "Key is required" });
  }

  try {
    const url = await generatePresignedUrl(key);
    if (!url) {
      return res.status(404).json({ error: "File not found" });
    }
    res.json({ url });
  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Export the Express app for Lambda
module.exports = app;
