// Runs before every test file via jest.setupFiles.
// Must be plain assignments — no imports — so env vars are set
// before any module that reads process.env is loaded.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_at_least_32_chars!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32chars!';
// Prefer DATABASE_URL injected by Docker/CI; otherwise derive it from DB_* vars
// so CI can override the database name without duplicating a full connection URL.
if (!process.env.DATABASE_URL) {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'time_reporting';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';

  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${database}`;
}
process.env.FRONTEND_URL = 'http://localhost:5173';
