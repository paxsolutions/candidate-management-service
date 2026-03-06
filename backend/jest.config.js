module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "routes/**/*.js",
    "middleware/**/*.js",
    "db/**/*.js",
    "server-export.js",
    "!node_modules/**",
  ],
  coverageDirectory: "coverage",
  setupFilesAfterEnv: ["./tests/setup.js"],
  // Prevent open handles from keeping Jest alive
  forceExit: true,
  // Increase timeout for async tests
  testTimeout: 10000,
};
