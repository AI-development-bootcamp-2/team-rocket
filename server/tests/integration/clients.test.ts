/**
 * Integration tests — Clients API (F05)
 *
 * Mirrors the pattern in tests/integration/auth.test.ts:
 * - real Postgres at DATABASE_URL (set in tests/setup.ts)
 * - TRUNCATE … RESTART IDENTITY CASCADE in beforeEach for isolation
 * - reuses the createUser / loginAndGetTokens / waitForAuditLog helper style
 *
 * These tests are written BEFORE the /clients module exists. They are expected
 * to fail in the TDD red phase (no route → 404, no service → 500). That is the
 * entire point — the implementation is the next step.
 */
import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../../src/database/connection') as Knex;

// ── DB helpers ────────────────────────────────────────────────────────────────

async function clearTables(): Promise<void> {
  // Extended truncate vs. auth.test.ts — the F05 surface touches clients,
  // projects, tasks, and the user_task_assignments join table.
  // CASCADE handles refresh_tokens, permission_flags, audit_logs FKs.
  await db.raw(
    'TRUNCATE users, audit_logs, clients, projects, tasks, user_task_assignments RESTART IDENTITY CASCADE',
  );
}

interface UserSeed {
  email?: string;
  password?: string;
  role?: 'admin' | 'user';
  isActive?: boolean;
}

async function createUser(
  seed: UserSeed = {},
): Promise<{ id: number; email: string; plainPassword: string }> {
  const {
    email = 'test@example.com',
    password = 'TestPass1!',
    role = 'user',
    isActive = true,
  } = seed;

  const passwordHash = await bcrypt.hash(password, 4);
  const [row] = (await db('users')
    .insert({
      email,
      password_hash: passwordHash,
      first_name: 'Test',
      last_name: 'User',
      role,
      is_active: isActive,
      must_change_password: false,
      failed_login_attempts: 0,
      lockout_until: null,
      employment_percentage: 100,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'email'])) as Array<{ id: number; email: string }>;

  return { id: row.id, email: row.email, plainPassword: password };
}

async function insertClient(seed: {
  name?: string;
  clientNumber?: string | null;
  contactInfo?: string | null;
  isActive?: boolean;
} = {}): Promise<{ id: number; name: string }> {
  const [row] = (await db('clients')
    .insert({
      name: seed.name ?? 'Seed Client',
      client_number: seed.clientNumber ?? null,
      contact_info: seed.contactInfo ?? null,
      is_active: seed.isActive ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'name'])) as Array<{ id: number; name: string }>;
  return row;
}

async function insertProject(seed: {
  clientId: number;
  name?: string;
  isActive?: boolean;
}): Promise<{ id: number }> {
  const [row] = (await db('projects')
    .insert({
      client_id: seed.clientId,
      name: seed.name ?? 'Seed Project',
      is_active: seed.isActive ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function insertTask(seed: { projectId: number; name?: string }): Promise<{ id: number }> {
  const [row] = (await db('tasks')
    .insert({
      project_id: seed.projectId,
      name: seed.name ?? 'Seed Task',
      status: 'open',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function assignUserToTask(userId: number, taskId: number): Promise<void> {
  await db('user_task_assignments').insert({
    user_id: userId,
    task_id: taskId,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function doLogin(email: string, password: string) {
  return request(app).post('/auth/login').send({ email, password });
}

async function loginAndGetTokens(seed: UserSeed = {}): Promise<{
  userId: number;
  email: string;
  accessToken: string;
}> {
  const user = await createUser(seed);
  const res = await doLogin(user.email, user.plainPassword);
  if (res.status !== 200) {
    throw new Error(`Login failed in test setup: ${JSON.stringify(res.body)}`);
  }
  return {
    userId: user.id,
    email: user.email,
    accessToken: res.body.accessToken as string,
  };
}

// ── Audit log helper ──────────────────────────────────────────────────────────

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
  await db.migrate.latest();
});

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await db.destroy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Clients API
// ─────────────────────────────────────────────────────────────────────────────

describe('Clients API', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // GET /clients
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /clients', () => {
    it('401 without token', async () => {
      const res = await request(app).get('/clients');
      expect(res.status).toBe(401);
    });

    it('200: admin sees all clients including inactive', async () => {
      const admin = await loginAndGetTokens({ email: 'admin-list@test.com', role: 'admin' });
      await insertClient({ name: 'Active Client' });
      await insertClient({ name: 'Archived Client', isActive: false });

      const res = await request(app)
        .get('/clients')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);
      const names = (res.body.data as Array<{ name: string }>).map((c) => c.name).sort();
      expect(names).toEqual(['Active Client', 'Archived Client']);
    });

    it('200: user sees only clients reachable via their user_task_assignments', async () => {
      const userLogin = await loginAndGetTokens({ email: 'scoped-user@test.com', role: 'user' });

      const visibleClient = await insertClient({ name: 'Visible Client' });
      const visibleProject = await insertProject({ clientId: visibleClient.id });
      const visibleTask = await insertTask({ projectId: visibleProject.id });
      await assignUserToTask(userLogin.userId, visibleTask.id);

      // Second client the user has no path to
      const hiddenClient = await insertClient({ name: 'Hidden Client' });
      const hiddenProject = await insertProject({ clientId: hiddenClient.id });
      await insertTask({ projectId: hiddenProject.id });

      const res = await request(app)
        .get('/clients')
        .set('Authorization', `Bearer ${userLogin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        id: visibleClient.id,
        name: 'Visible Client',
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /clients/:id
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /clients/:id', () => {
    it('401 without token', async () => {
      const res = await request(app).get('/clients/1');
      expect(res.status).toBe(401);
    });

    it('404: admin requesting unknown id', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });
      const res = await request(app)
        .get('/clients/999999')
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expect(res.status).toBe(404);
    });

    it('200: admin can fetch any client by id', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });
      const client = await insertClient({ name: 'Single Client', clientNumber: '#001' });

      const res = await request(app)
        .get(`/clients/${client.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: client.id,
        name: 'Single Client',
      });
    });

    it('user reading a client they have no assignment to is rejected (404 — implementations should not leak existence; matches F04 single-user 404 style)', async () => {
      // F04 returns 404 on /users/:id for unknown ids and 403 for non-admin
      // role at all. For F05 reads are User+Admin so the natural choice is to
      // hide existence — assert 404. If the implementation chooses 403 instead,
      // this test should be updated to match (single source of truth: spec).
      const userLogin = await loginAndGetTokens({ role: 'user' });
      const otherClient = await insertClient({ name: 'No Access' });

      const res = await request(app)
        .get(`/clients/${otherClient.id}`)
        .set('Authorization', `Bearer ${userLogin.accessToken}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /clients
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /clients', () => {
    it('401 without token', async () => {
      const res = await request(app).post('/clients').send({ name: 'Anon' });
      expect(res.status).toBe(401);
    });

    it('403: non-admin cannot create a client', async () => {
      const user = await loginAndGetTokens({ role: 'user' });
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Forbidden Client' });
      expect(res.status).toBe(403);
    });

    it('400: missing name', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ contact_info: 'no name here' });
      expect(res.status).toBe(400);
    });

    it('201: admin creates a valid client — defaults is_active=true and writes a CREATE audit row', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });

      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'New Client', contact_info: 'phone: 050-0000000' });

      expect(res.status).toBe(201);
      const created = (res.body.data ?? res.body) as { id: number; name: string; isActive?: boolean; is_active?: boolean };
      expect(created.id).toEqual(expect.any(Number));
      expect(created.name).toBe('New Client');
      expect(created.isActive ?? created.is_active).toBe(true);

      const log = await waitForAuditLog({
        action: 'CREATE',
        actor_user_id: admin.userId,
        target_entity_type: 'CLIENT',
        target_entity_id: created.id,
      });
      expect(log).toBeDefined();
    });

    it('201: admin can create with a unique client_number', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });

      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'Numbered Client', client_number: '#042' });

      expect(res.status).toBe(201);
      const created = (res.body.data ?? res.body) as { clientNumber?: string; client_number?: string };
      expect(created.clientNumber ?? created.client_number).toBe('#042');
    });

    it('409: duplicate client_number is rejected (matches F04 isUniqueViolation → 409 pattern)', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });
      await insertClient({ name: 'Existing', clientNumber: '#100' });

      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'Duplicate Number', client_number: '#100' });

      expect(res.status).toBe(409);
    });

    it('201 with warning: duplicate name (case-insensitive) against an active client returns the new row plus a warning string', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });
      await insertClient({ name: 'Acme Corp' });

      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'acme corp' });

      expect(res.status).toBe(201);
      // Spec is explicit about the body shape: { data: {...}, warning: '...' }
      expect(res.body).toMatchObject({
        data: expect.objectContaining({
          id: expect.any(Number),
          name: 'acme corp',
        }),
        warning: 'A client with this name already exists',
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PUT /clients/:id
  // ───────────────────────────────────────────────────────────────────────────
  describe('PUT /clients/:id', () => {
    it('401 without token', async () => {
      const res = await request(app).put('/clients/1').send({ name: 'X' });
      expect(res.status).toBe(401);
    });

    it('403: non-admin cannot update a client', async () => {
      const user = await loginAndGetTokens({ role: 'user' });
      const target = await insertClient({ name: 'Existing' });

      const res = await request(app)
        .put(`/clients/${target.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Renamed' });

      expect(res.status).toBe(403);
    });

    it('404: unknown id', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });
      const res = await request(app)
        .put('/clients/999999')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'Ghost' });
      expect(res.status).toBe(404);
    });

    it('200: admin updates name + contact_info + client_number; UPDATE audit row populates old_value/new_value', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });
      const target = await insertClient({
        name: 'Original Name',
        contactInfo: 'old contact',
        clientNumber: '#010',
      });

      const res = await request(app)
        .put(`/clients/${target.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'Updated Name',
          contact_info: 'new contact',
          client_number: '#011',
        });

      expect(res.status).toBe(200);
      const updated = (res.body.data ?? res.body) as { name: string };
      expect(updated.name).toBe('Updated Name');

      const log = await waitForAuditLog({
        action: 'UPDATE',
        actor_user_id: admin.userId,
        target_entity_type: 'CLIENT',
        target_entity_id: target.id,
      });
      expect(log.old_value).toBeDefined();
      expect(log.new_value).toBeDefined();
    });

    it('200: admin can flip is_active true → false → true via PUT', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });
      const target = await insertClient({ name: 'Toggle Me', isActive: true });

      const off = await request(app)
        .put(`/clients/${target.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ is_active: false });
      expect(off.status).toBe(200);
      let row = await db('clients').where({ id: target.id }).first();
      expect(row.is_active).toBe(false);

      const on = await request(app)
        .put(`/clients/${target.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ is_active: true });
      expect(on.status).toBe(200);
      row = await db('clients').where({ id: target.id }).first();
      expect(row.is_active).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /clients/:id
  // ───────────────────────────────────────────────────────────────────────────
  describe('DELETE /clients/:id', () => {
    it('401 without token', async () => {
      const res = await request(app).delete('/clients/1');
      expect(res.status).toBe(401);
    });

    it('403: non-admin cannot delete a client', async () => {
      const user = await loginAndGetTokens({ role: 'user' });
      const target = await insertClient({ name: 'Existing' });

      const res = await request(app)
        .delete(`/clients/${target.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(403);
    });

    it('404: unknown id', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });
      const res = await request(app)
        .delete('/clients/999999')
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expect(res.status).toBe(404);
    });

    it('200: admin soft-deletes — row remains with is_active=false and a DEACTIVATE audit row is written (matches F04 soft-delete action)', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });
      const target = await insertClient({ name: 'To Be Archived' });

      const res = await request(app)
        .delete(`/clients/${target.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);

      const row = await db('clients').where({ id: target.id }).first();
      expect(row).toBeDefined();
      expect(row.is_active).toBe(false);

      const log = await waitForAuditLog({
        action: 'DEACTIVATE',
        actor_user_id: admin.userId,
        target_entity_type: 'CLIENT',
        target_entity_id: target.id,
      });
      expect(log).toBeDefined();
    });

    it('200 with warning: archiving a client that has active projects returns a warning field about the related projects', async () => {
      const admin = await loginAndGetTokens({ role: 'admin' });
      const target = await insertClient({ name: 'Has Projects' });
      await insertProject({ clientId: target.id, name: 'Live Project A', isActive: true });
      await insertProject({ clientId: target.id, name: 'Live Project B', isActive: true });

      const res = await request(app)
        .delete(`/clients/${target.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.warning).toBe('string');
      expect(res.body.warning.length).toBeGreaterThan(0);
      // A meaningful warning should reference projects in some form
      expect(res.body.warning).toMatch(/project/i);
    });
  });
});
