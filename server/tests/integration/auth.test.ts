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

async function createClient(name = 'Test Client', isActive = true): Promise<{ id: number }> {
  const [row] = (await db('clients')
    .insert({
      name,
      is_active: isActive,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;

  return row;
}

async function createProject(seed: {
  name?: string;
  clientId?: number;
  isActive?: boolean;
} = {}): Promise<{ id: number }> {
  const clientId = seed.clientId ?? (await createClient()).id;
  const [row] = (await db('projects')
    .insert({
      client_id: clientId,
      name: seed.name ?? 'Test Project',
      is_active: seed.isActive ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;

  return row;
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

  it('204: succeeds without a Bearer token (cookie-based revocation — expired access tokens must not block logout)', async () => {
    // Logout is intentionally unauthenticated so a user with an expired access token
    // can still revoke their refresh-token cookie.
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(204);
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

describe('GET /users', () => {
  it('200: admin can list users and filter by role and is_active', async () => {
    const { accessToken } = await loginAndGetTokens({
      email: 'admin-list@test.com',
      role: 'admin',
    });

    await createUser({ email: 'active-user@test.com', role: 'user', isActive: true });
    await createUser({ email: 'inactive-user@test.com', role: 'user', isActive: false });
    await createUser({ email: 'other-admin@test.com', role: 'admin', isActive: true });

    const res = await request(app)
      .get('/users?role=user&is_active=true')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      email: 'active-user@test.com',
      role: 'user',
      isActive: true,
      firstName: 'Test',
      lastName: 'User',
    });
    expect(res.body.data[0].password_hash).toBeUndefined();
    expect(res.body.data[0].failed_login_attempts).toBeUndefined();
  });

  it('200: admin can search by email and full name', async () => {
    const { accessToken } = await loginAndGetTokens({
      email: 'admin-search@test.com',
      role: 'admin',
    });

    await createUser({ email: 'john.smith@test.com' });
    await db('users').where({ email: 'john.smith@test.com' }).update({
      first_name: 'John',
      last_name: 'Smith',
    });

    await createUser({ email: 'jane.doe@test.com' });
    await db('users').where({ email: 'jane.doe@test.com' }).update({
      first_name: 'Jane',
      last_name: 'Doe',
    });

    const byEmail = await request(app)
      .get('/users?search=john.smith')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data).toHaveLength(1);
    expect(byEmail.body.data[0].email).toBe('john.smith@test.com');

    const byFullName = await request(app)
      .get('/users?search=Jane Doe')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(byFullName.status).toBe(200);
    expect(byFullName.body.data).toHaveLength(1);
    expect(byFullName.body.data[0].email).toBe('jane.doe@test.com');
  });

  it('403: non-admin cannot list users', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'user' });

    const res = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });

  it('400: invalid filters are rejected', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'admin' });

    const res = await request(app)
      .get('/users?is_active=maybe')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/is_active/i);
  });
});

describe('GET /users/:id', () => {
  it('200: admin can fetch a single user by id', async () => {
    const { accessToken } = await loginAndGetTokens({
      email: 'admin-single@test.com',
      role: 'admin',
    });
    const target = await createUser({ email: 'single-user@test.com', role: 'user' });

    const res = await request(app)
      .get(`/users/${target.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: target.id,
      email: 'single-user@test.com',
      role: 'user',
      firstName: 'Test',
      lastName: 'User',
    });
    expect(res.body.password_hash).toBeUndefined();
    expect(res.body.failed_login_attempts).toBeUndefined();
  });

  it('404: unknown user id returns not found', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'admin' });

    const res = await request(app)
      .get('/users/999999')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it('400: invalid user id is rejected', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'admin' });

    const res = await request(app)
      .get('/users/not-a-number')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  it('403: non-admin cannot fetch a single user', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'user' });

    const res = await request(app)
      .get('/users/1')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /projects', () => {
  it('200: admin can list projects and filter by is_active', async () => {
    const admin = await loginAndGetTokens({ role: 'admin' });
    const activeClient = await createClient('Projects Client');
    const activeProject = await createProject({
      name: 'Active Project',
      clientId: activeClient.id,
      isActive: true,
    });
    await createProject({
      name: 'Inactive Project',
      clientId: activeClient.id,
      isActive: false,
    });

    const res = await request(app)
      .get('/projects?is_active=true')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: activeProject.id,
        name: 'Active Project',
        isActive: true,
        clientId: activeClient.id,
      }),
    ]);
  });

  it('200: admin can request inactive projects only', async () => {
    const admin = await loginAndGetTokens({ role: 'admin' });
    const client = await createClient('Inactive Filter Client');
    const inactiveProject = await createProject({
      name: 'Archive Me',
      clientId: client.id,
      isActive: false,
    });
    await createProject({
      name: 'Keep Active',
      clientId: client.id,
      isActive: true,
    });

    const res = await request(app)
      .get('/projects?is_active=false')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: inactiveProject.id,
        name: 'Archive Me',
        isActive: false,
        clientId: client.id,
      }),
    ]);
  });

  it('403: non-admin cannot list projects', async () => {
    const user = await loginAndGetTokens({ role: 'user' });

    const res = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('400: invalid is_active filter is rejected', async () => {
    const admin = await loginAndGetTokens({ role: 'admin' });

    const res = await request(app)
      .get('/projects?is_active=maybe')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(400);
  });
});

describe('POST /users', () => {
  it('201: admin can create a user with required and optional fields', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'admin' });

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        first_name: 'Dana',
        last_name: 'Levi',
        email: 'dana.levi@test.com',
        password: 'SecurePass1!',
        role: 'user',
        employee_number: 'EMP-42',
        employment_type: 'part_time',
        employment_percentage: 60,
        department: 'Finance',
        daily_hours_override: 6,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: 'dana.levi@test.com',
      firstName: 'Dana',
      lastName: 'Levi',
      role: 'user',
      isActive: true,
      mustChangePassword: true,
    });

    const created = await db('users').where({ email: 'dana.levi@test.com' }).first();
    expect(created).toBeDefined();
    expect(created.must_change_password).toBe(true);
    expect(created.employee_number).toBe('EMP-42');
    expect(created.employment_type).toBe('part_time');
    expect(created.employment_percentage).toBe(60);
  });

  it('409: duplicate email is rejected', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'admin' });
    await createUser({ email: 'duplicate@test.com' });

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        first_name: 'Dup',
        last_name: 'User',
        email: 'duplicate@test.com',
        password: 'SecurePass1!',
        role: 'user',
      });

    expect(res.status).toBe(409);
  });

  it('400: create user enforces password policy', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'admin' });

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        first_name: 'Weak',
        last_name: 'Password',
        email: 'weak.password@test.com',
        password: 'weak',
        role: 'user',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/requirements/i);
  });
});

describe('PUT /users/:id', () => {
  it('200: admin can update user fields', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'admin' });
    const target = await createUser({ email: 'update-me@test.com', role: 'user' });

    const res = await request(app)
      .put(`/users/${target.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        first_name: 'Updated',
        last_name: 'Person',
        email: 'updated.person@test.com',
        role: 'admin',
        is_active: true,
        employee_number: 'EMP-99',
        employment_type: 'contractor',
        employment_percentage: 80,
        department: 'Operations',
        daily_hours_override: 7,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: target.id,
      email: 'updated.person@test.com',
      firstName: 'Updated',
      lastName: 'Person',
      role: 'admin',
      isActive: true,
    });
  });
});

describe('DELETE /users/:id', () => {
  it('204: admin can deactivate a user and revoke all sessions', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'admin' });
    const targetLogin = await loginAndGetTokens({ email: 'deactivate-me@test.com', role: 'user' });

    const res = await request(app)
      .delete(`/users/${targetLogin.userId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);

    const updated = await db('users').where({ id: targetLogin.userId }).first();
    expect(updated.is_active).toBe(false);

    const refreshTokens = await db('refresh_tokens').where({ user_id: targetLogin.userId });
    expect(refreshTokens).toHaveLength(0);

    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', targetLogin.refreshCookie);
    expect(refreshRes.status).toBe(401);
  });

  it('403: admin cannot deactivate self', async () => {
    const adminLogin = await loginAndGetTokens({ role: 'admin' });

    const res = await request(app)
      .delete(`/users/${adminLogin.userId}`)
      .set('Authorization', `Bearer ${adminLogin.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: 'SELF_DEACTIVATION_FORBIDDEN',
      message: 'אינך יכול לבטל את הפעלת החשבון שלך',
    });
  });
});

describe('PUT /users/me', () => {
  it('200: authenticated user can update only own first and last name', async () => {
    const login = await loginAndGetTokens({ role: 'user' });

    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        first_name: 'Renamed',
        last_name: 'User',
        email: 'should-not-change@test.com',
        role: 'admin',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: login.userId,
      email: login.email,
      firstName: 'Renamed',
      lastName: 'User',
      role: 'user',
    });
  });
});

describe('POST /users/me/sort-preference', () => {
  it('204: stores sort preferences on the user record', async () => {
    const login = await loginAndGetTokens({ role: 'user' });
    const payload = {
      client_id: { '10': 3 },
      project_id: { '22': 7 },
      task_id: { '35': 12 },
    };

    const res = await request(app)
      .post('/users/me/sort-preference')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send(payload);

    expect(res.status).toBe(204);

    const updated = await db('users').where({ id: login.userId }).select('sort_prefs').first();
    expect(updated.sort_prefs).toEqual(payload);
  });
});

describe('Non-admin cannot access remaining admin user endpoints', () => {
  it('403: non-admin cannot create a user via POST /users', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'user' });

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        first_name: 'Hacker',
        last_name: 'McHack',
        email: 'hacker@test.com',
        password: 'SecurePass1!',
        role: 'user',
      });

    expect(res.status).toBe(403);
  });

  it('403: non-admin cannot update a user via PUT /users/:id', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'user' });
    const target = await createUser({ email: 'put-target@test.com', role: 'user' });

    const res = await request(app)
      .put(`/users/${target.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        first_name: 'Updated',
        last_name: 'User',
        email: target.email,
        role: 'user',
        is_active: true,
      });

    expect(res.status).toBe(403);
  });

  it('403: non-admin cannot deactivate a user via DELETE /users/:id', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'user' });
    const target = await createUser({ email: 'delete-target@test.com', role: 'user' });

    const res = await request(app)
      .delete(`/users/${target.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });

  it('403: non-admin cannot reset a password via POST /users/:id/reset-password', async () => {
    const { accessToken } = await loginAndGetTokens({ role: 'user' });
    const target = await createUser({ email: 'reset-rbac@test.com', role: 'user' });

    const res = await request(app)
      .post(`/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });
});

describe('Permission flags', () => {
  it('201/200/204: admin can grant, list, and revoke a permission flag', async () => {
    const admin = await loginAndGetTokens({ role: 'admin' });
    const target = await createUser({ email: 'flag-target@test.com', role: 'user' });
    const projectA = await createProject({ name: 'Project A' });
    const projectB = await createProject({ name: 'Project B' });

    const createRes = await request(app)
      .post(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        flag_name: 'canAssignProjectTasks',
        scoped_project_ids: [projectA.id, projectB.id],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      userId: target.id,
      flagName: 'canAssignProjectTasks',
      scopedProjectIds: [projectA.id, projectB.id],
      grantedBy: admin.userId,
    });

    const listRes = await request(app)
      .get(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0]).toMatchObject({
      id: createRes.body.id,
      userId: target.id,
      flagName: 'canAssignProjectTasks',
    });

    const deleteRes = await request(app)
      .delete(`/users/${target.id}/permissions/${createRes.body.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(deleteRes.status).toBe(204);

    const afterDelete = await request(app)
      .get(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(afterDelete.status).toBe(200);
    expect(afterDelete.body.data).toHaveLength(0);
  });

  it('400: scoped_project_ids must reference valid active projects', async () => {
    const admin = await loginAndGetTokens({ role: 'admin' });
    const target = await createUser({ email: 'flag-invalid@test.com', role: 'user' });
    const inactiveProject = await createProject({ name: 'Inactive Project', isActive: false });

    const res = await request(app)
      .post(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        flag_name: 'canAssignProjectTasks',
        scoped_project_ids: [inactiveProject.id],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scoped_project_ids/i);
  });

  it('403: non-admin cannot manage permission flags', async () => {
    const user = await loginAndGetTokens({ role: 'user' });
    const target = await createUser({ email: 'flag-no-admin@test.com', role: 'user' });

    const createRes = await request(app)
      .post(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        flag_name: 'canAssignProjectTasks',
        scoped_project_ids: [],
      });
    expect(createRes.status).toBe(403);

    const listRes = await request(app)
      .get(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(listRes.status).toBe(403);
  });

  it('scoped_project_ids correctly restricts the flag to only the granted projects', async () => {
    const admin = await loginAndGetTokens({ role: 'admin' });
    const target = await createUser({ email: 'flag-scope@test.com', role: 'user' });
    const projectA = await createProject({ name: 'Scoped Project A' });
    const projectB = await createProject({ name: 'Scoped Project B' });
    const projectC = await createProject({ name: 'Out of Scope Project C' });

    // Grant flag scoped to A and B only — C is intentionally excluded
    const createRes = await request(app)
      .post(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        flag_name: 'canAssignProjectTasks',
        scoped_project_ids: [projectA.id, projectB.id],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.scopedProjectIds).toEqual(
      expect.arrayContaining([projectA.id, projectB.id]),
    );
    expect(createRes.body.scopedProjectIds).not.toContain(projectC.id);
    expect(createRes.body.scopedProjectIds).toHaveLength(2);

    // Verify persisted scoping via GET
    const listRes = await request(app)
      .get(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(listRes.status).toBe(200);
    const flag = listRes.body.data[0] as { scopedProjectIds: number[] };
    expect(flag.scopedProjectIds).toEqual(expect.arrayContaining([projectA.id, projectB.id]));
    expect(flag.scopedProjectIds).not.toContain(projectC.id);
    expect(flag.scopedProjectIds).toHaveLength(2);
  });
});

describe('POST /users/:id/reset-password', () => {
  it('200: admin can reset a user password — returns temporaryPassword and sets must_change_password', async () => {
    const admin = await loginAndGetTokens({ role: 'admin' });
    const target = await createUser({ email: 'reset-target@test.com', role: 'user' });
    const temporaryPassword = 'TempReset1!';

    const res = await request(app)
      .post(`/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ temporary_password: temporaryPassword });

    expect(res.status).toBe(200);
    expect(res.body.temporaryPassword).toBe(temporaryPassword);

    const updated = await db('users').where({ id: target.id }).select('must_change_password').first();
    expect(updated.must_change_password).toBe(true);
  });

  it('200: reset revokes all active sessions for the target user', async () => {
    const admin = await loginAndGetTokens({ role: 'admin' });
    // Log the target user in so they have an active refresh token
    const target = await loginAndGetTokens({ email: 'reset-sessions@test.com', role: 'user' });

    const tokensBefore = await db('refresh_tokens').where({ user_id: target.userId }).count('id as count').first();
    expect(Number(tokensBefore?.count)).toBeGreaterThan(0);

    await request(app)
      .post(`/users/${target.userId}/reset-password`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ temporary_password: 'SessionKill1!' })
      .expect(200);

    const tokensAfter = await db('refresh_tokens').where({ user_id: target.userId }).count('id as count').first();
    expect(Number(tokensAfter?.count)).toBe(0);
  });

  it('200: reset is audit logged with PASSWORD_RESET action', async () => {
    const admin = await loginAndGetTokens({ role: 'admin' });
    const target = await createUser({ email: 'reset-audit@test.com', role: 'user' });

    await request(app)
      .post(`/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ temporary_password: 'AuditReset1!' })
      .expect(200);

    const log = await waitForAuditLog({
      action: 'PASSWORD_RESET',
      actor_user_id: admin.userId,
      target_entity_id: target.id,
    });
    expect(log).toBeDefined();
  });

  it('403: non-admin cannot reset a user password', async () => {
    const user = await loginAndGetTokens({ role: 'user' });
    const target = await createUser({ email: 'reset-forbidden@test.com', role: 'user' });

    const res = await request(app)
      .post(`/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ temporary_password: 'Forbidden1!' });

    expect(res.status).toBe(403);
  });

  it('404: reset for unknown user returns not found', async () => {
    const admin = await loginAndGetTokens({ role: 'admin' });

    const res = await request(app)
      .post('/users/999999/reset-password')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ temporary_password: 'UnknownUser1!' });

    expect(res.status).toBe(404);
  });

  it('400: reset requires a valid temporary password from the admin', async () => {
    const admin = await loginAndGetTokens({ role: 'admin' });
    const target = await createUser({ email: 'reset-invalid@test.com', role: 'user' });

    const res = await request(app)
      .post(`/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ temporary_password: 'short' });

    expect(res.status).toBe(400);
  });
});

describe('RBAC — requireRole', () => {
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

  it('writes CREATE, UPDATE, and DEACTIVATE audit records for admin user mutations', async () => {
    const admin = await loginAndGetTokens({ role: 'admin' });

    const createRes = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        first_name: 'Audit',
        last_name: 'Target',
        email: 'audit.target@test.com',
        password: 'SecurePass1!',
        role: 'user',
      });
    expect(createRes.status).toBe(201);
    const createdId = createRes.body.id as number;

    await request(app)
      .put(`/users/${createdId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        first_name: 'Audited',
        last_name: 'Target',
        email: 'audit.target.updated@test.com',
        role: 'user',
        is_active: true,
      })
      .expect(200);

    await request(app)
      .delete(`/users/${createdId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(204);

    const createLog = await waitForAuditLog({
      action: 'CREATE',
      actor_user_id: admin.userId,
      target_entity_id: createdId,
    });
    const updateLog = await waitForAuditLog({
      action: 'UPDATE',
      actor_user_id: admin.userId,
      target_entity_id: createdId,
    });
    const deactivateLog = await waitForAuditLog({
      action: 'DEACTIVATE',
      actor_user_id: admin.userId,
      target_entity_id: createdId,
    });

    expect(createLog).toBeDefined();
    expect(updateLog.old_value).toBeDefined();
    expect(updateLog.new_value).toBeDefined();
    expect(deactivateLog.old_value).toBeDefined();
    expect(deactivateLog.new_value).toBeDefined();
  });
});
