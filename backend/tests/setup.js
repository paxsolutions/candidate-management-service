// Silence console.error and console.warn during tests to keep output clean.
// Errors are still asserted via HTTP status codes and response bodies.
// Uses plain function replacement (not jest.spyOn) to avoid interference
// with jest.clearAllMocks() in individual test files.
const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  console.error = () => {};
  console.warn = () => {};
});

afterEach(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
