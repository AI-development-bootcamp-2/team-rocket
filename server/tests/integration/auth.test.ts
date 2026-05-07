/**
 * Integration tests — Auth flow (F03-BE)
 *
 * Requires a running Postgres instance at DATABASE_URL (set in tests/setup.ts).
 *
 * Isolation strategy: beforeEach truncates users + audit_logs with CASCADE.
 * - CASCADE reaches refresh_tokens, permission_flags, user_task_assignments, etc.
 *   because all have FK → users.
 * - audit_logs has ON DELETE SET NULL (not CASCADE) so it is listed explicitly.
 * - RESTART IDENTITY resets the id sequence → IDs start at 1 in every test.
 */
import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Request, Response } from 'express';
import app from '../../src/app';
import { authenticate } from '../../src/middleware/auth.middleware';
import { requireRole } from '../../src/middleware/rbac.middleware';
import { errorMiddleware } from '../../src/middleware/error.middleware';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../../src/database/connection') as Knex;

// ── Test-only admin route ─────────────────────────────────────────────────────
// Mounted once at module load. No production route covers admin-only access yet,
// so we wire one here to exercise the full authenticate → requireRole('admin') chain.
app.get(
  '/test/admin-only',
  authenticate,
  requireRole('admin'),
  (_req: Request, res: Response) => {
    res.json({ ok: true });
  },
);
app.use(errorMiddleware);

// ── DB helpers ────────────────────────────────────────────────────────────────

async function clearTables(): Promise<void> {
  await db.raw('TRUNCATE users, audit_logs RESTART IDENTITY CASCADE');
}

interface UserSeed {
  email?: string;
  password?: string;
  role?: 'admin' | 'user';
  isActive?: boolean;
  mustChangePassword?: boolean;
  failedLoginAttempts?: number;
  lockoutUntil?: Date | null;
}

async function createUser(
  seed: UserSeed = {},
): Promise<{ id: number; email: string; plainPassword: string }> {
  const {
    email = 'test@example.com',
    password = 'TestPass1!',
    role = 'user',
    isActive = true,
    mustChangePassword = false,
    failedLoginAttempts = 0,
    lockoutUntil = null,
  } = seed;

  // Cost 4 (bcrypt minimum) for speed — the hash / compare code path still runs.
  const passwordHash = await bcrypt.hash(password, 4);

  const [row] = (await db('users')
    .insert({
      email,
      password_hash: passwordHash,
      first_name: 'Test',
      last_name: 'User',
      role,
      is_active: isActive,
      must_change_password: mustChangePassword,
      failed_login_attempts: failedLoginAttempts,
      lockout_until: lockoutUntil,
      employment_percentage: 100,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'email'])) as Array<{ id: number; email: string }>;

  return { id: row.id, email: row.email, plainPassword: password };
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

// Low-level login call — used in tests that need direct access to the response.
function doLogin(email: string, password: string) {
  return request(app).post('/auth/login').send({ email, password });
}

// Returns the "name=value" segment of the refreshToken Set-Cookie header.
// Browsers only send this part back — not the attributes (Path, HttpOnly, etc.).
// Handles both supertest (string) and raw Node http (string[]) header shapes.
function pickRefreshCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const entries: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string'
    ? [raw]
    : [];
  const entry = entries.find((h) => h.startsWith('refreshToken='));
  if (!entry) throw new Error('refreshToken cookie not found in response headers');
  return entry.split(';')[0];
}

// Creates a user, logs in, and returns tokens. Used by most tests as a setup shortcut.
async function loginAndGetTokens(seed: UserSeed = {}): Promise<{
  userId: number;
  email: string;
  plainPassword: string;
  accessToken: string;
  refreshCookie: string;
}> {
  const user = await createUser(seed);
  const res = await doLogin(user.email, user.plainPassword);
  if (res.status !== 200) throw new Error(`Login failed in test setup: ${JSON.stringify(res.body)}`);
  return {
    userId: user.id,
    email: user.email,
    plainPassword: user.plainPassword,
    accessToken: res.body.accessToken as string,
    refreshCookie: pickRefreshCookie(res),
  };
}

// ── Audit log helper ──────────────────────────────────────────────────────────

// Polls the DB for an audit log record because writeAuditLog is fire-and-forget
// in the controller — the INSERT may not have committed before the assertion runs.
async function waitForAuditLog(
  where: Record<string, unknown>,
  timeoutMs = 1_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = (await db('audit_logs')
      .where(where)
      .first()) as Record<string, unknown> | undefined;
    if (row) return row;
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Audit log not found within ${timeoutMs}ms — query: ${JSON.stringify(where)}`);
}

// ── Suite lifecycle ───────────────────────────────────────────────────────────

beforeAll(async () => {
  // Run any pending migrations — idempotent, safe to call on an already-migrated DB.
  await db.migrate.latest();
});

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  // Close the Knex connection pool; otherwise Jest hangs after the suite finishes.
  await db.destroy();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('200: returns accessToken, user object, and an HttpOnly refresh cookie', async () => {
    await createUser({ email: 'admin@test.com', role: 'admin' });

    const res = await doLogin('admin@test.com', 'TestPass1!');

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user).toMatchObject({
      email: 'admin@test.com',
      role: 'admin',
      mustChangePassword: false,
    });
    // Sensitive fields must never be returned
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user.failed_login_attempts).toBeUndefined();

    // set-cookie is string in @types/supertest but string[] in raw Node — widen
    // to the union first, then normalise to an array so find() always works.
    const rawSetCookie = res.headers['set-cookie'] as string | string[] | undefined;
    const cookies: string[] = Array.isArray(rawSetCookie)
      ? rawSetCookie
      : rawSetCookie
      ? [rawSetCookie]
      : [];
    const refreshEntry = cookies.find((c) => c.startsWith('refreshToken='));
    expect(refreshEntry).toBeDefined();
    expect(refreshEntry).toContain('HttpOnly');
    expect(refreshEntry).toContain('Path=/auth');
  });

  it('401: wrong password — same error message as unknown email (no account enumeration)', async () => {
    await createUser({ email: 'user@test.com' });

    const [wrongPassword, unknownEmail] = await Promise.all([
      doLogin('user@test.com', 'WrongPass1!'),
      doLogin('nobody@test.com', 'SomePass1!'),
    ]);

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
  });

  it('401: inactive user is rejected even with correct password', async () => {
    await createUser({ email: 'gone@test.com', isActive: false });
    const res = await doLogin('gone@test.com', 'TestPass1!');
    expect(res.status).toBe(401);
  });

  it('400: missing required fields in request body', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@test.com' }); // password missing
    expect(res.status).toBe(400);
  });

  it('increments failed_login_attempts on each wrong password', async () => {
    await createUser({ email: 'user@test.com' });

    await doLogin('user@test.com', 'Wrong1!');
    await doLogin('user@test.com', 'Wrong1!');

    const row = await db('users')
      .where({ email: 'user@test.com' })
      .select('failed_login_attempts')
      .first();
    expect(row.failed_login_attempts).toBe(2);
  });

  it('423: account locks after 5 consecutive failures', async () => {
    await createUser({ email: 'user@test.com' });

    // Failures 1–5: each returns 401
    for (let i = 0; i < 5; i++) {
      const r = await doLogin('user@test.com', 'Wrong1!');
      expect(r.status).toBe(401);
    }

    // 6th attempt: lockout is now active
    const res = await doLogin('user@test.com', 'Wrong1!');
    expect(res.status).toBe(423);
    expect(res.body.error).toMatch(/locked/i);
  });

  it('423: correct password is also blocked while the account is locked', async () => {
    // assertNotLocked runs before comparePassword — bcrypt is never reached.
    await createUser({ email: 'user@test.com' });

    for (let i = 0; i < 5; i++) {
      await doLogin('user@test.com', 'Wrong1!');
    }

    const res = await doLogin('user@test.com', 'TestPass1!');
    expect(res.status).toBe(423);
  });

  it('resets failed_login_attempts and lockout_until on successful login', async () => {
    await createUser({ email: 'user@test.com', failedLoginAttempts: 3 });

    await doLogin('user@test.com', 'TestPass1!');

    const row = await db('users')
      .where({ email: 'user@test.com' })
      .select('failed_login_attempts', 'lockout_until')
      .first();
    expect(row.failed_login_attempts).toBe(0);
    expect(row.lockout_until).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('204: marks the refresh token revoked in DB', async () => {
    const { accessToken, refreshCookie } = await loginAndGetTokens();

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(204);

    const revokedRow = await db('refresh_tokens').whereNotNull('revoked_at').first();
    expect(revokedRow).toBeDefined();
    expect(revokedRow.revoked_at).not.toBeNull();
  });

  it('revoked token is rejected on the next /auth/refresh call', async () => {
    const { accessToken, refreshCookie } = await loginAndGetTokens();

    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', refreshCookie);

    // The same cookie cannot be used again
    const res = await request(app).post('/auth/refresh').set('Cookie', refreshCookie);
    expect(res.status).toBe(401);
  });

  it('401: requires a Bearer token', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(401);
  });

  it('204: succeeds silently when the refresh cookie is absent (double-logout tolerance)', async () => {
    const { accessToken } = await loginAndGetTokens();

    // Logout without sending any cookie — should not error
    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/refresh
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('200: issues a new accessToken and rotates the refresh cookie', async () => {
    const { refreshCookie: originalCookie } = await loginAndGetTokens();

    const res = await request(app).post('/auth/refresh').set('Cookie', originalCookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');

    // A new cookie must be present
    const newCookie = pickRefreshCookie(res);
    // The JWT string itself must differ — it is a freshly signed token
    expect(newCookie).not.toBe(originalCookie);
  });

  it('401: replaying the old token after rotation is rejected (rotation test)', async () => {
    // This test verifies the core security property of token rotation:
    // once a token has been consumed by /auth/refresh, it must never work again.
    const { refreshCookie: originalCookie } = await loginAndGetTokens();

    // Step 1 — valid rotation: old token is revoked, new one issued
    await request(app).post('/auth/refresh').set('Cookie', originalCookie).expect(200);

    // Step 2 — replay: the original token's hash has revoked_at set in DB
    const res = await request(app).post('/auth/refresh').set('Cookie', originalCookie);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid|revoked/i);
  });

  it('401: no cookie in the request', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('401: deactivated user is rejected at refresh time', async () => {
    // Simulates admin deactivating a user mid-session.
    const { refreshCookie, userId } = await loginAndGetTokens();

    await db('users').where({ id: userId }).update({ is_active: false });

    const res = await request(app).post('/auth/refresh').set('Cookie', refreshCookie);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/change-password
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/change-password', () => {
  it('200: updates the password hash and clears mustChangePassword', async () => {
    const { accessToken, userId, plainPassword } = await loginAndGetTokens({
      mustChangePassword: true,
    });

    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: plainPassword, newPassword: 'NewSecure9@' });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');

    const updated = await db('users')
      .where({ id: userId })
      .select('must_change_password')
      .first();
    expect(updated.must_change_password).toBe(false);
  });

  it('all other sessions are invalidated after a password change', async () => {
    // Verifies revokeAllUserTokens was called — a second device cannot refresh
    // after the first device changes the password.
    const { email, plainPassword, accessToken } = await loginAndGetTokens();

    // Simulate a concurrent session on another device
    const secondLogin = await doLogin(email, plainPassword);
    const secondCookie = pickRefreshCookie(secondLogin);

    await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: plainPassword, newPassword: 'NewSecure9@' });

    const res = await request(app).post('/auth/refresh').set('Cookie', secondCookie);
    expect(res.status).toBe(401);
  });

  it('401: wrong current password', async () => {
    const { accessToken } = await loginAndGetTokens();

    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'NotMyPassword1!', newPassword: 'NewSecure9@' });

    expect(res.status).toBe(401);
  });

  it('400: new password violates policy', async () => {
    const { accessToken, plainPassword } = await loginAndGetTokens();

    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: plainPassword, newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/requirements/i);
  });

  it('401: requires a Bearer token', async () => {
    const res = await request(app)
      .post('/auth/change-password')
      .send({ currentPassword: 'any', newPassword: 'NewSecure9@' });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/me
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /users/me', () => {
  it('200: returns user profile and omits all sensitive fields', async () => {
    const { accessToken, email } = await loginAndGetTokens({ role: 'admin' });

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email,
      role: 'admin',
      firstName: 'Test',
      lastName: 'User',
    });
    // Fields that must never leave the server
    expect(res.body.password_hash).toBeUndefined();
    expect(res.body.failed_login_attempts).toBeUndefined();
    expect(res.body.lockout_until).toBeUndefined();
  });

  it('401: no Authorization header', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('401: tampered token is rejected', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.bad.payload');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RBAC — requireRole middleware
// ─────────────────────────────────────────────────────────────────────────────

describe('RBAC — requireRole', () => {
  // Tests use the /test/admin-only route mounted at the top of this file.
  // It exercises the real authenticate → requireRole('admin') chain without
  // modifying any production route definitions.

  it('200: admin token is granted access', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'admin' });

    const res = await request(app)
      .get('/test/admin-only')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it('403: user-role token is rejected with Insufficient permissions', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'user' });

    const res = await request(app)
      .get('/test/admin-only')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient/i);
  });

  it('401: unauthenticated request is rejected before role check', async () => {
    const res = await request(app).get('/test/admin-only');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Audit logs
// ─────────────────────────────────────────────────────────────────────────────

describe('Audit logs', () => {
  // writeAuditLog is fire-and-forget in the controller.
  // waitForAuditLog polls until the DB row appears (up to 1 s).

  it('writes a LOGIN record with success:true on successful login', async () => {
    const user = await createUser({ email: 'audit-ok@test.com' });
    await doLogin(user.email, user.plainPassword);

    const log = await waitForAuditLog({ action: 'LOGIN', actor_user_id: user.id });
    const newValue = log.new_value as Record<string, unknown>;

    expect(newValue.success).toBe(true);
  });

  it('writes a LOGIN record with success:false on wrong password', async () => {
    const user = await createUser({ email: 'audit-fail@test.com' });
    await doLogin(user.email, 'WrongPass1!');

    const log = await waitForAuditLog({ action: 'LOGIN', actor_user_id: user.id });
    const newValue = log.new_value as Record<string, unknown>;

    expect(newValue.success).toBe(false);
    expect(newValue.reason).toBe('invalid_password');
  });

  it('writes a PASSWORD_RESET record on a successful password change', async () => {
    const { accessToken, userId, plainPassword } = await loginAndGetTokens();

    await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: plainPassword, newPassword: 'NewSecure9@' });

    const log = await waitForAuditLog({ action: 'PASSWORD_RESET', actor_user_id: userId });
    expect(log).toBeDefined();
  });
});
