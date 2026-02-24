// External API routes for third-party access
// Returns limited fields only: first_name, last_name, email, phone_number, state
const express = require("express");
const router = express.Router();
const apiKeyAuth = require("../middleware/apiKeyAuth");
const { searchCandidates, getCandidateById } = require("../db/dynamodb");

// Apply API key authentication to all routes in this router
router.use(apiKeyAuth);

// Filter function to return only allowed fields
const filterFields = (candidate) => {
  if (!candidate) return null;

  return {
    id: candidate.id,
    first_name: candidate.first_name || "",
    last_name: candidate.last_name || "",
    email: candidate.email || "",
    phone_number: candidate.phone_number || "",
    state: candidate.state || "",
  };
};

// GET /external/candidates - Search candidates with pagination (limited fields)
router.get("/candidates", async (req, res) => {
  try {
    const {
      search = "",
      sort = "first_name",
      order = "ASC",
      page = 1,
      limit = 100,
    } = req.query;
    const offset = (page - 1) * limit;

    const result = await searchCandidates({
      search,
      sort,
      order,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Filter to only include allowed fields
    const filteredData = result.data.map(filterFields);

    res.json({
      data: filteredData,
      total: result.total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(result.total / limit),
    });
  } catch (error) {
    console.error("External API Error:", error);
    res.status(500).json({ error: "Failed to fetch candidates data" });
  }
});

// GET /external/candidates/:id - Get single candidate by ID (limited fields)
router.get("/candidates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const candidate = await getCandidateById(id);

    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    // Return only allowed fields
    res.json(filterFields(candidate));
  } catch (error) {
    console.error("External API Error:", error);
    res.status(500).json({ error: "Failed to fetch candidate data" });
  }
});

module.exports = router;
