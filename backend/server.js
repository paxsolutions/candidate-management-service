// Load environment-specific configuration
const envFile =
  process.env.NODE_ENV === "production" ? "../.env" : "../.env.development";
require("dotenv").config({ path: envFile });

const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const passport = require("./config/passport");
const authRoutes = require("./routes/auth");
const healthRoutes = require("./routes/health");
const mysql = require("mysql2");
const cors = require("cors");

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
const DB_TABLE = process.env.DB_TABLE_NAME;

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize MySQL session store
let sessionStore;

if (process.env.NODE_ENV === "production") {
  // Use MySQL for production (shared session store)
  const sessionStoreOptions = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 minutes
    expiration: 86400000, // 24 hours
    createDatabaseTable: true,
    schema: {
      tableName: "sessions",
      columnNames: {
        session_id: "session_id",
        expires: "expires",
        data: "data",
      },
    },
  };

  try {
    sessionStore = new MySQLStore(sessionStoreOptions);
  } catch (error) {
    console.warn("Failed to initialize MySQL session store:", error.message);
    sessionStore = undefined; // Will use default MemoryStore
  }
}

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

// Session configuration with MySQL store
app.use(
  session({
    store: sessionStore, // Will be MySQL in production, MemoryStore in dev
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "pax.session.id",
    cookie: {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      // No domain restriction - let browser handle it automatically
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/auth", authRoutes);
app.use("/api", healthRoutes);

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.get("/api/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json(req.user);
});

// Get all candidates with pagination and search
app.get("/api/candidates", (req, res) => {
  const {
    search = "",
    sort = "create_time",
    order = "desc",
    page = 1,
    limit = 100,
  } = req.query;
  const offset = (page - 1) * limit;

  // Build the WHERE clause for advanced search
  let whereClause = "1=1"; // Default to true for no search
  let countWhereClause = "1=1";
  let values = [];
  let countValues = [];

  if (search.trim()) {
    // Split search into individual terms (words)
    const searchTerms = search.trim().toLowerCase().split(/\s+/);

    // Build conditions where ALL terms must match (each can be in any field)
    const termConditions = searchTerms.map((term) => {
      // Each term must match at least one field (as a partial match)
      return `(
        LOWER(favourite) LIKE ? OR
        LOWER(first_name) LIKE ? OR
        LOWER(last_name) LIKE ? OR
        LOWER(email) LIKE ? OR
        LOWER(state) LIKE ?
      )`;
    });

    // Combine with AND so all terms must be present
    whereClause = termConditions.join(" AND ");
    countWhereClause = whereClause;

    // Add values for each term (5 fields per term for the main query)
    searchTerms.forEach((term) => {
      const searchPattern = `%${term}%`;
      values.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
      );
      countValues.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
      );
    });
  }

  // Add pagination values
  values.push(parseInt(limit), parseInt(offset));

  let query = `SELECT * FROM ${DB_TABLE} WHERE ${whereClause} ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`;

  db.query(query, values, (err, results) => {
    if (err) {
      console.error("Query Error:", err);
      return res.status(500).json({ error: err.message });
    }

    db.query(
      `SELECT COUNT(*) AS total FROM ${DB_TABLE} WHERE ${countWhereClause}`,
      countValues,
      (countErr, countResults) => {
        if (countErr) {
          console.error("Count Query Error:", countErr);
          return res.status(500).json({ error: countErr.message });
        }
        res.json({ data: results, total: countResults[0].total });
      },
    );
  });
});

// Get a single candidate by ID with all fields
app.get("/api/candidates/:id", (req, res) => {
  const { id } = req.params;

  db.query(`SELECT * FROM ${DB_TABLE} WHERE id = ?`, [id], (err, results) => {
    if (err) {
      console.error("Query Error:", err);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    res.json(results[0]);
  });
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Environment:", process.env.NODE_ENV || "development");
});
