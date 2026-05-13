/// <reference types="jest" />
/**
 * Integration tests — Audit Log module (F17)
 * KAN-130 / KAN-296..313
 *
 * Coverage:
 *  GET /audit-logs  — auth (KAN-311), response shape, pagination, all filters
 *  Write paths      — every event the spec mandates creates a correct DB record
 *    KAN-297  login success / failure
 *    KAN-298  time entry CREATE / UPDATE / DELETE; user CREATE; client CREATE
 *    KAN-304  admin edit of another user's entry → ADMIN_EDIT
 *    KAN-305  deactivate user → DEACTIVATE
 *    KAN-306  admin password reset → PASSWORD_RESET
 *    KAN-300  month lock / unlock (with reason)
 *    KAN-309  rejection reason stored in audit record
 *    KAN-313  old_value + new_value captured on UPDATE
 */

import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../../src/database/connection') as Knex;

// ── DB seed helpers ───────────────────────────────────────────────────────────

async function clearTables(): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await db.raw('TRUNCATE users, audit_logs, clients RESTART IDENTITY CASCADE');
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
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'email'])) as Array<{ id: number; email: string }>;

  return { id: row.id, email: row.email, plainPassword: password };
}

async function seedClient(name = 'Test Client', isActive = true): Promise<{ id: number }> {
  const [row] = (await db('clients')
    .insert({ name, is_active: isActive, created_at: new Date(), updated_at: new Date() })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedProject(seed: {
  clientId: number;
  name?: string;
  isActive?: boolean;
}): Promise<{ id: number }> {
  const [row] = (await db('projects')
    .insert({
      client_id: seed.clientId,
      name: seed.name ?? 'Test Project',
      is_active: seed.isActive ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedTask(seed: {
  projectId: number;
  name?: string;
  status?: 'open' | 'closed';
}): Promise<{ id: number }> {
  const [row] = (await db('tasks')
    .insert({
      project_id: seed.projectId,
      name: seed.name ?? 'Test Task',
      status: seed.status ?? 'open',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedAssignment(userId: number, taskId: number, isActive = true): Promise<void> {
  await db('user_task_assignments').insert({
    user_id: userId,
    task_id: taskId,
    is_active: isActive,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

// Inserts a raw audit_logs row directly — used for filter / pagination tests
// that need deterministic data without going through the API.
async function seedAuditLog(params: {
  actorUserId?: number | null;
  entityType: string;
  entityId?: number | null;
  action: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
  ipAddress?: string | null;
  timestamp?: Date;
}): Promise<{ id: number }> {
  const [row] = (await db('audit_logs')
    .insert({
      actor_user_id: params.actorUserId ?? null,
      target_entity_type: params.entityType,
      target_entity_id: params.entityId ?? null,
      action: params.action,
      old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
      new_value: params.newValue ? JSON.stringify(params.newValue) : null,
      reason: params.reason ?? null,
      ip_address: params.ipAddress ?? null,
      timestamp: params.timestamp ?? new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  return res.body.accessToken as string;
}

// Short pause for fire-and-forget audit inserts to land before we query.
const waitForAudit = () => new Promise((r) => setTimeout(r, 60));

// ── Test lifecycle ────────────────────────────────────────────────────────────

beforeEach(clearTables);
afterAll(() => db.destroy());

// ─────────────────────────────────────────────────────────────────────────────
// GET /audit-logs — authentication & authorization (KAN-311)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /audit-logs — auth (KAN-311)', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/audit-logs');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin (regular user)', async () => {
    const user = await seedUser({ role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get('/audit-logs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 for an admin user', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/audit-logs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /audit-logs — response shape
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /audit-logs — response shape', () => {
  it('returns paginated envelope: data, total, page, limit', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    await seedAuditLog({ entityType: 'USER', action: 'LOGIN', actorUserId: admin.id });

    const res = await request(app)
      .get('/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
      limit: expect.any(Number),
    });
  });

  it('audit log record contains all required fields', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    // Use MONTH_LOCK so we can isolate this record with entity_type filter.
    await seedAuditLog({
      entityType: 'MONTH_LOCK',
      action: 'LOCK',
      actorUserId: admin.id,
      entityId: 7,
      newValue: { locked: true },
      ipAddress: '10.0.0.1',
    });

    const res = await request(app)
      .get('/audit-logs?entity_type=MONTH_LOCK')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    const record = res.body.data[0];
    expect(record).toHaveProperty('id');
    expect(record).toHaveProperty('actor_user_id', admin.id);
    expect(record).toHaveProperty('target_entity_type', 'MONTH_LOCK');
    expect(record).toHaveProperty('target_entity_id', 7);
    expect(record).toHaveProperty('action', 'LOCK');
    expect(record).toHaveProperty('timestamp');
    expect(record).toHaveProperty('ip_address', '10.0.0.1');
    expect(record).toHaveProperty('old_value');
    expect(record).toHaveProperty('new_value');
    expect(record).toHaveProperty('reason');
  });

  it('returns records ordered newest first', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    const older = new Date(Date.now() - 60_000);
    const newer = new Date();
    // Use MONTH_LOCK to isolate from USER/LOGIN records from admin login.
    await seedAuditLog({ entityType: 'MONTH_LOCK', action: 'LOCK', timestamp: older });
    await seedAuditLog({ entityType: 'MONTH_LOCK', action: 'UNLOCK', timestamp: newer });

    const res = await request(app)
      .get('/audit-logs?entity_type=MONTH_LOCK')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const actions = res.body.data.map((r: { action: string }) => r.action);
    expect(actions[0]).toBe('UNLOCK');
    expect(actions[1]).toBe('LOCK');
  });

  it('returns empty data array and total 0 when no records exist', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    // clearTables deletes audit_logs too, so the LOGIN from seedUser login
    // may not be in the table yet (fire-and-forget). We only check shape.
    const res = await request(app)
      .get('/audit-logs?entity_type=CLIENT&action=DELETE')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('old_value and new_value are returned as objects (not raw JSON strings)', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    // Use MONTH_LOCK so entity_type filter isolates this record from
    // the USER/LOGIN fire-and-forget audit that login creates.
    await seedAuditLog({
      entityType: 'MONTH_LOCK',
      action: 'UNLOCK',
      oldValue: { is_locked: true },
      newValue: { is_locked: false },
    });

    const res = await request(app)
      .get('/audit-logs?entity_type=MONTH_LOCK')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    const rec = res.body.data[0];
    expect(typeof rec.old_value).toBe('object');
    expect(typeof rec.new_value).toBe('object');
    expect(rec.old_value).toMatchObject({ is_locked: true });
    expect(rec.new_value).toMatchObject({ is_locked: false });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /audit-logs — pagination
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /audit-logs — pagination', () => {
  it('defaults to 25 rows per page when limit is omitted', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    // Use CLIENT entity type so the USER/LOGIN from admin login doesn't pollute the count.
    for (let i = 0; i < 30; i++) {
      await seedAuditLog({ entityType: 'CLIENT', action: 'CREATE' });
    }

    const res = await request(app)
      .get('/audit-logs?entity_type=CLIENT')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(25);
    expect(res.body.limit).toBe(25);
    expect(res.body.total).toBe(30);
  });

  it('respects a custom limit', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    for (let i = 0; i < 10; i++) {
      await seedAuditLog({ entityType: 'USER', action: 'LOGIN' });
    }

    const res = await request(app)
      .get('/audit-logs?limit=4')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
    expect(res.body.limit).toBe(4);
  });

  it('returns the correct page of results', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    // Create 6 additional audit logs (login above creates 1, so total will be 7)
    // We want 6 for pagination test, so clear the login entry
    for (let i = 0; i < 7; i++) {
      await seedAuditLog({ entityType: 'USER', action: 'LOGIN' });
    }

    const p1 = await request(app)
      .get('/audit-logs?limit=3&page=1')
      .set('Authorization', `Bearer ${token}`);
    const p2 = await request(app)
      .get('/audit-logs?limit=3&page=2')
      .set('Authorization', `Bearer ${token}`);

    expect(p1.status).toBe(200);
    expect(p1.body.data).toHaveLength(3);
    expect(p1.body.page).toBe(1);
    expect(p2.body.data).toHaveLength(3);
    expect(p2.body.page).toBe(2);

    // Pages should return distinct record IDs.
    const ids1 = p1.body.data.map((r: { id: number }) => r.id);
    const ids2 = p2.body.data.map((r: { id: number }) => r.id);
    expect(ids1).not.toEqual(ids2);
    expect(new Set([...ids1, ...ids2]).size).toBe(6);
  });

  it('total reflects the unfiltered count, not just the current page', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    // Use CLIENT entity type so the USER/LOGIN from admin login doesn't pollute the count.
    for (let i = 0; i < 15; i++) {
      await seedAuditLog({ entityType: 'CLIENT', action: 'CREATE' });
    }

    const res = await request(app)
      .get('/audit-logs?limit=5&page=2&entity_type=CLIENT')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(15);
    expect(res.body.data).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /audit-logs — filters
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /audit-logs — filters', () => {
  it('filters by entity_type', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    // Use MONTH_LOCK — login never creates these, so the count is deterministic.
    await seedAuditLog({ entityType: 'MONTH_LOCK', action: 'LOCK' });
    await seedAuditLog({ entityType: 'TIME_ENTRY', action: 'CREATE' });
    await seedAuditLog({ entityType: 'CLIENT', action: 'CREATE' });

    const res = await request(app)
      .get('/audit-logs?entity_type=MONTH_LOCK')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].target_entity_type).toBe('MONTH_LOCK');
  });

  it('filters by action', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    await seedAuditLog({ entityType: 'USER', action: 'LOGIN' });
    await seedAuditLog({ entityType: 'USER', action: 'CREATE' });
    await seedAuditLog({ entityType: 'TIME_ENTRY', action: 'DELETE' });

    const res = await request(app)
      .get('/audit-logs?action=CREATE')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].action).toBe('CREATE');
  });

  it('filters by user_id (actor)', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    // Use MONTH_LOCK entity type so login records (USER) don't pollute the count.
    await seedAuditLog({ entityType: 'MONTH_LOCK', action: 'LOCK', actorUserId: admin.id });
    await seedAuditLog({ entityType: 'MONTH_LOCK', action: 'LOCK', actorUserId: user.id });

    const res = await request(app)
      .get(`/audit-logs?user_id=${admin.id}&entity_type=MONTH_LOCK`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].actor_user_id).toBe(admin.id);
  });

  it('filters by entity_id', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    await seedAuditLog({ entityType: 'USER', action: 'UPDATE', entityId: 10 });
    await seedAuditLog({ entityType: 'USER', action: 'UPDATE', entityId: 99 });

    const res = await request(app)
      .get('/audit-logs?entity_id=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].target_entity_id).toBe(10);
  });

  it('filters by date_from (inclusive)', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const now = new Date();
    // Use MONTH_LOCK entity type so login records (USER) don't pollute date-based count.
    await seedAuditLog({ entityType: 'MONTH_LOCK', action: 'LOCK', timestamp: yesterday });
    await seedAuditLog({ entityType: 'MONTH_LOCK', action: 'UNLOCK', timestamp: now });

    const today = now.toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/audit-logs?date_from=${today}&entity_type=MONTH_LOCK`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].action).toBe('UNLOCK');
  });

  it('filters by date_to (inclusive of full day)', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1_000);
    const now = new Date();
    await seedAuditLog({ entityType: 'USER', action: 'LOGIN', timestamp: twoDaysAgo });
    await seedAuditLog({ entityType: 'USER', action: 'CREATE', timestamp: now });

    const dayStr = twoDaysAgo.toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/audit-logs?date_to=${dayStr}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].action).toBe('LOGIN');
  });

  it('combines entity_type + action + user_id filters', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(admin.email, admin.plainPassword);

    // Use MONTH_LOCK to avoid USER/LOGIN records from admin login polluting the count.
    await seedAuditLog({ entityType: 'MONTH_LOCK', action: 'LOCK', actorUserId: admin.id });
    await seedAuditLog({ entityType: 'MONTH_LOCK', action: 'UNLOCK', actorUserId: admin.id });
    await seedAuditLog({ entityType: 'MONTH_LOCK', action: 'LOCK', actorUserId: user.id });

    const res = await request(app)
      .get(`/audit-logs?entity_type=MONTH_LOCK&action=LOCK&user_id=${admin.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('returns 400 for an invalid entity_type value', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/audit-logs?entity_type=INVALID_ENTITY')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid action value', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/audit-logs?action=INVALID_ACTION')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Write paths — login events (KAN-297)
// ─────────────────────────────────────────────────────────────────────────────

describe('Write path — login events (KAN-297)', () => {
  it('records a LOGIN audit entry with success:true on successful login', async () => {
    const user = await seedUser({ email: 'logintest@test.com' });

    await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: user.plainPassword });

    await waitForAudit();

    const logs = await db('audit_logs')
      .where({ action: 'LOGIN', actor_user_id: user.id })
      .select('*') as Array<{ new_value: { success: boolean } | null }>;

    const successLog = logs.find((l) => l.new_value && (l.new_value as { success: boolean }).success === true);
    expect(successLog).toBeDefined();
  });

  it('records a LOGIN audit entry with success:false on wrong password', async () => {
    const user = await seedUser({ email: 'logintest@test.com' });

    await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: 'WrongPass99!' });

    await waitForAudit();

    const logs = await db('audit_logs')
      .where({ action: 'LOGIN', actor_user_id: user.id })
      .select('*') as Array<{ new_value: { success: boolean; reason: string } | null }>;

    const failLog = logs.find((l) => l.new_value && (l.new_value as { success: boolean }).success === false);
    expect(failLog).toBeDefined();
    expect((failLog!.new_value as { reason: string }).reason).toBe('invalid_password');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Write paths — time entry events (KAN-298, KAN-304, KAN-313)
// ─────────────────────────────────────────────────────────────────────────────

describe('Write path — time entry events (KAN-298, KAN-304, KAN-313)', () => {
  async function setupTimeEntryCtx() {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const adminToken = await login(admin.email, admin.plainPassword);
    const userToken = await login(user.email, user.plainPassword);
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    await seedAssignment(user.id, task.id);
    return { admin, user, adminToken, userToken, clientId: client.id, projectId: project.id, taskId: task.id };
  }

  it('creates a CREATE audit record when a time entry is created', async () => {
    const ctx = await setupTimeEntryCtx();

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${ctx.userToken}`)
      .send({
        date: '2025-01-15',
        start_time: '09:00',
        end_time: '17:00',
        client_id: ctx.clientId,
        project_id: ctx.projectId,
        task_id: ctx.taskId,
        location: 'office',
      });

    expect(res.status).toBe(201);
    await waitForAudit();

    const logs = await db('audit_logs')
      .where({ action: 'CREATE', target_entity_type: 'TIME_ENTRY', actor_user_id: ctx.user.id })
      .select('*');

    expect(logs).toHaveLength(1);
    expect(logs[0].target_entity_id).toBe(res.body.id);
    expect(logs[0].new_value).not.toBeNull();
  });

  it('creates an UPDATE audit record with old_value and new_value (KAN-313)', async () => {
    const ctx = await setupTimeEntryCtx();

    const createRes = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${ctx.userToken}`)
      .send({
        date: '2025-01-15',
        start_time: '09:00',
        end_time: '17:00',
        client_id: ctx.clientId,
        project_id: ctx.projectId,
        task_id: ctx.taskId,
        location: 'office',
      });
    expect(createRes.status).toBe(201);
    await waitForAudit();

    const updateRes = await request(app)
      .put(`/time-entries/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ctx.userToken}`)
      .send({
        start_time: '10:00',
        end_time: '18:00',
        client_id: ctx.clientId,
        project_id: ctx.projectId,
        task_id: ctx.taskId,
        location: 'home',
        version: createRes.body.version,
      });
    expect(updateRes.status).toBe(200);
    await waitForAudit();

    const logs = await db('audit_logs')
      .where({
        action: 'UPDATE',
        target_entity_type: 'TIME_ENTRY',
        target_entity_id: createRes.body.id,
      })
      .select('*') as Array<{ old_value: Record<string, string> | null; new_value: Record<string, string> | null }>;

    expect(logs).toHaveLength(1);
    expect(logs[0].old_value).not.toBeNull();
    expect(logs[0].new_value).not.toBeNull();
    // Verify old start_time is captured
    expect(String(logs[0].old_value!.start_time)).toMatch(/09:00/);
    expect(String(logs[0].new_value!.start_time)).toMatch(/10:00/);
  });

  it('creates a DELETE audit record when a time entry is soft-deleted', async () => {
    const ctx = await setupTimeEntryCtx();

    const createRes = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${ctx.userToken}`)
      .send({
        date: '2025-01-15',
        start_time: '09:00',
        end_time: '17:00',
        client_id: ctx.clientId,
        project_id: ctx.projectId,
        task_id: ctx.taskId,
        location: 'office',
      });
    expect(createRes.status).toBe(201);
    await waitForAudit();

    await request(app)
      .delete(`/time-entries/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ctx.userToken}`);

    await waitForAudit();

    const logs = await db('audit_logs')
      .where({
        action: 'DELETE',
        target_entity_type: 'TIME_ENTRY',
        target_entity_id: createRes.body.id,
      })
      .select('*');

    expect(logs).toHaveLength(1);
    expect(logs[0].old_value).not.toBeNull();
  });

  it('creates an ADMIN_EDIT audit record when admin edits another user\'s entry (KAN-304)', async () => {
    const ctx = await setupTimeEntryCtx();

    // User creates a time entry
    const createRes = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${ctx.userToken}`)
      .send({
        date: '2025-01-15',
        start_time: '09:00',
        end_time: '17:00',
        client_id: ctx.clientId,
        project_id: ctx.projectId,
        task_id: ctx.taskId,
        location: 'office',
      });
    expect(createRes.status).toBe(201);
    await waitForAudit();

    // Admin edits that entry
    const updateRes = await request(app)
      .put(`/time-entries/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({
        start_time: '08:00',
        end_time: '16:00',
        client_id: ctx.clientId,
        project_id: ctx.projectId,
        task_id: ctx.taskId,
        location: 'client',
        version: createRes.body.version,
      });
    expect(updateRes.status).toBe(200);
    await waitForAudit();

    const logs = await db('audit_logs')
      .where({
        action: 'ADMIN_EDIT',
        target_entity_type: 'TIME_ENTRY',
        target_entity_id: createRes.body.id,
      })
      .select('*');

    expect(logs).toHaveLength(1);
    expect(logs[0].actor_user_id).toBe(ctx.admin.id);
    expect(logs[0].old_value).not.toBeNull();
    expect(logs[0].new_value).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Write paths — user management (KAN-298, KAN-305)
// ─────────────────────────────────────────────────────────────────────────────

describe('Write path — user management (KAN-298, KAN-305)', () => {
  it('creates a CREATE audit record when an admin creates a new user', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const adminToken = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'newuser@test.com',
        first_name: 'New',
        last_name: 'User',
        role: 'user',
        password: 'SecurePass1!',
      });

    expect(res.status).toBe(201);

    const logs = await db('audit_logs')
      .where({ action: 'CREATE', target_entity_type: 'USER', target_entity_id: res.body.id })
      .select('*');

    expect(logs).toHaveLength(1);
    expect(logs[0].actor_user_id).toBe(admin.id);
    expect(logs[0].new_value).not.toBeNull();
  });

  it('creates a DEACTIVATE audit record when an admin deactivates a user (KAN-305)', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const adminToken = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .delete(`/users/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    const logs = await db('audit_logs')
      .where({
        action: 'DEACTIVATE',
        target_entity_type: 'USER',
        target_entity_id: target.id,
      })
      .select('*');

    expect(logs).toHaveLength(1);
    expect(logs[0].actor_user_id).toBe(admin.id);
    expect(logs[0].old_value).not.toBeNull();
    expect(logs[0].new_value).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Write paths — password reset (KAN-306)
// ─────────────────────────────────────────────────────────────────────────────

describe('Write path — password reset (KAN-306)', () => {
  it('creates a PASSWORD_RESET audit record on admin reset', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const adminToken = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post(`/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ temporary_password: 'TempPass1!' });

    expect(res.status).toBe(200);

    await waitForAudit();

    const logs = await db('audit_logs')
      .where({
        action: 'PASSWORD_RESET',
        target_entity_type: 'USER',
        target_entity_id: target.id,
      })
      .select('*');

    expect(logs).toHaveLength(1);
    expect(logs[0].actor_user_id).toBe(admin.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Write paths — month lock / unlock (KAN-300, KAN-309 reason)
// ─────────────────────────────────────────────────────────────────────────────

describe('Write path — month lock / unlock (KAN-300)', () => {
  it('creates a LOCK audit record when a month is locked', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const adminToken = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/admin/months/2025/3/lock')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    await waitForAudit();

    const logs = await db('audit_logs')
      .where({ action: 'LOCK', target_entity_type: 'MONTH_LOCK' })
      .select('*');

    expect(logs).toHaveLength(1);
    expect(logs[0].actor_user_id).toBe(admin.id);
  });

  it('creates an UNLOCK audit record with reason stored (KAN-309)', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const adminToken = await login(admin.email, admin.plainPassword);

    // Lock first
    await request(app)
      .post('/admin/months/2025/3/lock')
      .set('Authorization', `Bearer ${adminToken}`);
    await waitForAudit();

    // Unlock with reason
    const res = await request(app)
      .post('/admin/months/2025/3/unlock')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Employee forgot to log hours' });

    expect(res.status).toBe(200);
    await waitForAudit();

    const logs = await db('audit_logs')
      .where({ action: 'UNLOCK', target_entity_type: 'MONTH_LOCK' })
      .select('*');

    expect(logs).toHaveLength(1);
    // KAN-309: rejection/unlock reason stored in the audit record
    expect(logs[0].reason).toBe('Employee forgot to log hours');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /audit-logs — confirms old/new value round-trip (KAN-313)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /audit-logs — old_value and new_value round-trip (KAN-313)', () => {
  it('returns old_value and new_value as objects when seeded directly', async () => {
    const admin = await seedUser({ role: 'admin', email: 'admin@test.com' });
    const token = await login(admin.email, admin.plainPassword);

    await seedAuditLog({
      entityType: 'TIME_ENTRY',
      action: 'UPDATE',
      actorUserId: admin.id,
      oldValue: { start_time: '09:00', location: 'office' },
      newValue: { start_time: '10:00', location: 'home' },
    });

    const res = await request(app)
      .get('/audit-logs?entity_type=TIME_ENTRY&action=UPDATE')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].old_value).toMatchObject({ start_time: '09:00', location: 'office' });
    expect(res.body.data[0].new_value).toMatchObject({ start_time: '10:00', location: 'home' });
  });
});
