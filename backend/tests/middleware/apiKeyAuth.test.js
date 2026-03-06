const apiKeyAuth = require("../../middleware/apiKeyAuth");

describe("apiKeyAuth middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    process.env.EXTERNAL_API_KEY = "valid-test-key";
  });

  afterEach(() => {
    delete process.env.EXTERNAL_API_KEY;
  });

  it("should return 401 when no API key is provided", () => {
    apiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "API key required" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 500 when EXTERNAL_API_KEY is not configured", () => {
    delete process.env.EXTERNAL_API_KEY;
    req.headers["x-api-key"] = "some-key";

    apiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "API key validation not configured" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 when API key is invalid", () => {
    req.headers["x-api-key"] = "wrong-key";

    apiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid API key" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next() when API key is valid", () => {
    req.headers["x-api-key"] = "valid-test-key";

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
