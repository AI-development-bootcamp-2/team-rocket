/**
 * Integration tests — Users module (F04)
 *
 * Requires a running Postgres instance at DATABASE_URL (set in tests/setup.ts).
 *
 * Isolation: beforeEach truncates users + audit_logs CASCADE.
 * RESTART IDENTITY resets id sequences → IDs start at 1 in every test.
 */
import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../../src/database/connection') as Knex;

// ── DB helpers ────────────────────────────────────────────────────────────────

async function clearTables(): Promise<void> {
  // users CASCADE drops refresh_tokens, permission_flags, user_task_assignments, etc.
  // audit_logs.actor_user_id has ON DELETE SET NULL so must be listed explicitly.
  //
  // Retry on deadlock: some controller failure paths fire-and-forget an audit
  // INSERT. The concurrent INSERT + TRUNCATE can deadlock; PostgreSQL will abort
  // one of them. We retry up to 3 times with a short back-off.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await db.raw('TRUNCATE users, audit_logs RESTART IDENTITY CASCADE');
      return;
    } catch (err: unknown) {
      const isDeadlock =
        err instanceof Error &&
        (err.message.includes('deadlock') || (err as { code?: string }).code === '40P01');
      if (isDeadlock && attempt < 3) {
        await new Promise((r) => setTimeout(r, 30 * attempt));
        continue;
      }
      throw err;
    }
  }
}

interface UserSeed {
  email?: string;
  password?: string;
  role?: 'admin' | 'user';
  isActive?: boolean;
  firstName?: string;
  lastName?: string;
}

async function seedUser(
  seed: UserSeed = {},
): Promise<{ id: number; email: string; plainPassword: string }> {
  const {
    email = 'test@example.com',
    password = 'TestPass1!',
    role = 'user',
    isActive = true,
    firstName = 'Test',
    lastName = 'User',
  } = seed;

  const passwordHash = await bcrypt.hash(password, 4);
  const [row] = (await db('users')
    .insert({
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      role,
      is_active: isActive,
      must_change_password: false,
      failed_login_attempts: 0,
      employment_percentage: 100,
      employment_type: 'full_time',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'email'])) as Array<{ id: number; email: string }>;

  return { id: row.id, email: row.email, plainPassword: password };
}

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  return res.body.accessToken as string;
}

// ── Suite lifecycle ───────────────────────────────────────────────────────────

beforeAll(async () => {
  await db.migrate.latest();
});

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await db.destroy();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /users
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /users', () => {
  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });

  it('403: non-admin user is rejected', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200: admin gets all users', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    await seedUser({ email: 'other@test.com', role: 'user' });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toHaveProperty('email');
    expect(res.body.data[0]).not.toHaveProperty('password_hash');
  });

  it('200: filter by role=admin returns only admins', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    await seedUser({ email: 'user@test.com', role: 'user' });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/users?role=admin')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((u: { role: string }) => u.role === 'admin')).toBe(true);
  });

  it('200: filter by is_active=false returns only inactive users', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    await seedUser({ email: 'inactive@test.com', role: 'user', isActive: false });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/users?is_active=false')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((u: { isActive: boolean }) => u.isActive === false)).toBe(true);
  });

  it('200: search by name/email is case-insensitive', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    await seedUser({ email: 'alice@test.com', role: 'user', firstName: 'Alice' });
    await seedUser({ email: 'bob@test.com', role: 'user', firstName: 'Bob' });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/users?search=ALICE')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].email).toBe('alice@test.com');
  });

  it('200: returns empty array when no users match filter', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/users?search=nonexistent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /users/:id', () => {
  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app).get('/users/1');
    expect(res.status).toBe(401);
  });

  it('403: non-admin is rejected', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200: admin gets user by id', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get(`/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('target@test.com');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('404: non-existent user returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/users/99999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('400: invalid id (non-numeric) returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/users/abc')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/me
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /users/me', () => {
  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('200: returns own profile for any authenticated user', async () => {
    const user = await seedUser({ email: 'me@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@test.com');
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body).not.toHaveProperty('failed_login_attempts');
  });

  it('200: works for admin too', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /users (Create)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /users', () => {
  const validBody = {
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@test.com',
    password: 'NewPass1!',
    role: 'user',
    employment_type: 'full_time',
    employment_percentage: 100,
  };

  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app).post('/users').send(validBody);
    expect(res.status).toBe(401);
  });

  it('403: non-admin cannot create users', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(403);
  });

  it('201: admin creates a new user', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('jane@test.com');
    expect(res.body.role).toBe('user');
    expect(res.body.isActive).toBe(true);
    expect(res.body.mustChangePassword).toBe(true);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('400: missing required fields returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'incomplete@test.com' });

    expect(res.status).toBe(400);
  });

  it('400: weak password returns 400 with violations', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, email: 'weak@test.com', password: 'weak' });

    expect(res.status).toBe(400);
  });

  it('409: duplicate email returns 409', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    await seedUser({ email: 'jane@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(409);
  });

  it('400: invalid role value returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, email: 'role@test.com', role: 'superuser' });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /users/:id (Update)
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /users/:id', () => {
  const updatedBody = {
    first_name: 'Updated',
    last_name: 'Name',
    email: 'updated@test.com',
    role: 'user',
    employment_type: 'full_time',
    employment_percentage: 80,
  };

  it('403: non-admin cannot update users', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .put(`/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatedBody);

    expect(res.status).toBe(403);
  });

  it('200: admin can update user fields', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put(`/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...updatedBody, email: 'target@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Updated');
    expect(res.body.lastName).toBe('Name');
  });

  it('404: updating non-existent user returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put('/users/99999')
      .set('Authorization', `Bearer ${token}`)
      .send(updatedBody);

    expect(res.status).toBe(404);
  });

  it('400: invalid role value returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put(`/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...updatedBody, email: 'target@test.com', role: 'superuser' });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /users/:id (Soft Deactivate)
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /users/:id', () => {
  it('403: non-admin cannot deactivate users', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const other = await seedUser({ email: 'other@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .delete(`/users/${other.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('204: admin deactivates a user — sets is_active=false', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .delete(`/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    // Verify in DB
    const row = await db('users').where('id', target.id).first();
    expect(row.is_active).toBe(false);
  });

  it('403: admin cannot deactivate themselves', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .delete(`/users/${admin.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SELF_DEACTIVATION_FORBIDDEN');
  });

  it('404: deactivating non-existent user returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .delete('/users/99999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('204: deactivated user cannot log in', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    // Deactivate
    await request(app)
      .delete(`/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    // Try to login
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: target.email, password: target.plainPassword });

    expect(loginRes.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /users/me (Update own profile)
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /users/me', () => {
  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app)
      .put('/users/me')
      .send({ first_name: 'A', last_name: 'B' });
    expect(res.status).toBe(401);
  });

  it('200: user can update their own name', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'NewFirst', last_name: 'NewLast' });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('NewFirst');
    expect(res.body.lastName).toBe('NewLast');
    // Email must not change
    expect(res.body.email).toBe('user@test.com');
  });

  it('400: missing first_name returns 400', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ last_name: 'Only' });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /users/me/sort-preference
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /users/me/sort-preference', () => {
  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app)
      .post('/users/me/sort-preference')
      .send({ clientId: 1, projectId: 2, taskId: 3 });
    expect(res.status).toBe(401);
  });

  it('204: user can update sort preferences', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/users/me/sort-preference')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: 1, projectId: 2, taskId: 3 });

    expect(res.status).toBe(204);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /users/:id/reset-password
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /users/:id/reset-password', () => {
  it('403: non-admin cannot reset passwords', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const other = await seedUser({ email: 'other@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post(`/users/${other.id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ temporary_password: 'TempPass1!' });

    expect(res.status).toBe(403);
  });

  it('200: admin resets a user password — returns temporaryPassword', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post(`/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ temporary_password: 'TempPass1!' });

    expect(res.status).toBe(200);
    expect(typeof res.body.temporaryPassword).toBe('string');
  });

  it('200: user can login with new temp password and must_change_password=true', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app)
      .post(`/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ temporary_password: 'TempPass1!' });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: target.email, password: 'TempPass1!' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.mustChangePassword).toBe(true);
  });

  it('400: missing temporary_password returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post(`/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('400: weak temporary_password returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post(`/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ temporary_password: 'weak' });

    expect(res.status).toBe(400);
  });

  it('404: non-existent user returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/users/99999/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ temporary_password: 'TempPass1!' });

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/:id/permissions
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /users/:id/permissions', () => {
  it('403: non-admin cannot view permissions', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get(`/users/${user.id}/permissions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('200: admin gets empty permissions list for a new user', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /users/:id/permissions (Grant)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /users/:id/permissions', () => {
  it('403: non-admin cannot grant permissions', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post(`/users/${user.id}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ flag_name: 'canAssignProjectTasks', scoped_project_ids: [] });

    expect(res.status).toBe(403);
  });

  it('201: admin grants canAssignProjectTasks with empty scope', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ flag_name: 'canAssignProjectTasks', scoped_project_ids: [] });

    expect(res.status).toBe(201);
    expect(res.body.flagName).toBe('canAssignProjectTasks');
    expect(res.body.scopedProjectIds).toEqual([]);
    expect(res.body.userId).toBe(target.id);
  });

  it('400: invalid flag_name returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ flag_name: 'nonExistentFlag', scoped_project_ids: [] });

    expect(res.status).toBe(400);
  });

  it('404: granting permission to non-existent user returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/users/99999/permissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ flag_name: 'canAssignProjectTasks', scoped_project_ids: [] });

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /users/:id/permissions/:flagId (Revoke)
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /users/:id/permissions/:flagId', () => {
  it('403: non-admin cannot revoke permissions', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .delete(`/users/${user.id}/permissions/1`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('204: admin can revoke a permission flag', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    // First grant
    const grantRes = await request(app)
      .post(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ flag_name: 'canAssignProjectTasks', scoped_project_ids: [] });

    expect(grantRes.status).toBe(201);
    const flagId = grantRes.body.id as number;

    // Then revoke
    const revokeRes = await request(app)
      .delete(`/users/${target.id}/permissions/${flagId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(revokeRes.status).toBe(204);

    // Verify gone
    const listRes = await request(app)
      .get(`/users/${target.id}/permissions`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body.data).toHaveLength(0);
  });

  it('404: revoking non-existent flag returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .delete(`/users/${target.id}/permissions/99999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
