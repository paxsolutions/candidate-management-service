const express = require("express");
const router = express.Router();

// Health check endpoint for load balancer
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "pax-backend",
    version: process.env.npm_package_version || "1.0.0",
  });
});

// Detailed health check with database connectivity
router.get("/health/detailed", async (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "pax-backend",
    version: process.env.npm_package_version || "1.0.0",
    checks: {
      database: "unknown",
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    },
  };

  // Check database connectivity
  try {
    // You can add a simple database query here
    // For now, we'll just check if DB_HOST is configured
    if (process.env.DB_HOST) {
      health.checks.database = "configured";
    } else {
      health.checks.database = "not_configured";
    }
  } catch (error) {
    health.checks.database = "error";
    health.status = "unhealthy";
  }

  const statusCode = health.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
