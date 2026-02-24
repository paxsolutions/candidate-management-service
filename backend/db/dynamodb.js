// DynamoDB client for candidates data
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DB_TABLE_NAME;

// Get candidate by ID
async function getCandidateById(id) {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: String(id) },
  });

  const result = await docClient.send(command);
  return result.Item || null;
}

// Search candidates with filters, sort, and pagination
async function searchCandidates({
  search = "",
  sort = "id",
  order = "ASC",
  limit = 10,
  offset = 0,
}) {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
  });

  const result = await docClient.send(command);
  let items = result.Items || [];

  // Apply search filter (case-insensitive, multi-word search across fields)
  if (search) {
    const searchTerms = search
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    items = items.filter((item) => {
      // Check if ALL search terms are found in ANY of the searchable fields
      return searchTerms.every((term) => {
        const favourite = item.favourite
          ? String(item.favourite).toLowerCase()
          : "";
        const firstName = item.first_name ? item.first_name.toLowerCase() : "";
        const lastName = item.last_name ? item.last_name.toLowerCase() : "";
        const email = item.email ? item.email.toLowerCase() : "";
        const state = item.state ? item.state.toLowerCase() : "";

        return (
          favourite.includes(term) ||
          firstName.includes(term) ||
          lastName.includes(term) ||
          email.includes(term) ||
          state.includes(term)
        );
      });
    });
  }

  // Get total before pagination
  const total = items.length;

  // Apply sorting
  const orderMultiplier = order.toUpperCase() === "DESC" ? -1 : 1;
  items.sort((a, b) => {
    const aVal = a[sort] || "";
    const bVal = b[sort] || "";

    if (aVal < bVal) return -1 * orderMultiplier;
    if (aVal > bVal) return 1 * orderMultiplier;
    return 0;
  });

  // Apply pagination
  const startIndex = parseInt(offset);
  const endIndex = startIndex + parseInt(limit);
  const paginatedItems = items.slice(startIndex, endIndex);

  return {
    data: paginatedItems,
    total: total,
  };
}

module.exports = {
  getCandidateById,
  searchCandidates,
};
