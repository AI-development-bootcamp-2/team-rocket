// Runs before every test file via jest.setupFiles.
// Must be plain assignments — no imports — so env vars are set
// before any module that reads process.env is loaded.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_at_least_32_chars!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32chars!';
// Prefer DATABASE_URL injected by Docker/CI; fall back to local host for direct runs.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
}
process.env.FRONTEND_URL = 'http://localhost:5173';
