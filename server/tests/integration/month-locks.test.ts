/// <reference types="jest" />
/**
 * Integration tests — Month Lock/Unlock module (F15)
 *
 * Requires a running Postgres instance at DATABASE_URL (set in tests/setup.ts).
 *
 * Coverage:
 *  Auth guards
 *  GET  /admin/months                       — list all locked months
 *  GET  /admin/months/:year/:month/status   — lock status + unapproved_week_count
 *  POST /admin/months/:year/:month/lock     — lock, idempotency, audit log, fan-out
 *  POST /admin/months/:year/:month/unlock   — reason required, stores in both tables
 */
import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../../src/database/connection') as Knex;

// ── DB helpers ────────────────────────────────────────────────────────────────

async function clearTables(): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await db.raw(
        'TRUNCATE users, audit_logs, clients, month_locks, notifications, weekly_submissions RESTART IDENTITY CASCADE',
      );
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

async function seedUser(
  seed: { email?: string; password?: string; role?: 'admin' | 'user'; isActive?: boolean } = {},
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
      employment_percentage: 100,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'email'])) as Array<{ id: number; email: string }>;
  return { id: row.id, email: row.email, plainPassword: password };
}

async function seedWeeklySubmission(
  userId: number,
  weekStartDate: string,
  status: 'draft' | 'submitted' | 'approved' | 'rejected',
): Promise<void> {
  await db('weekly_submissions').insert({
    user_id: userId,
    week_start_date: weekStartDate,
    status,
    submitted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });
}

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  return res.body.accessToken as string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await db.migrate.latest();
});

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await db.destroy();
});

// ── Auth guards ───────────────────────────────────────────────────────────────

describe('Month Locks — auth guards', () => {
  it('GET /admin/months without token → 401', async () => {
    const res = await request(app).get('/admin/months');
    expect(res.status).toBe(401);
  });

  it('GET /admin/months as regular user → 403', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get('/admin/months')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('POST /admin/months/:year/:month/lock as regular user → 403', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/admin/months/2026/5/lock')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('GET /admin/months/:year/:month/status without token → 401', async () => {
    const res = await request(app).get('/admin/months/2026/5/status');
    expect(res.status).toBe(401);
  });
});

// ── GET /admin/months ─────────────────────────────────────────────────────────

describe('GET /admin/months', () => {
  it('returns empty array when no months have been locked', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/admin/months')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns locked months ordered newest first', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app).post('/admin/months/2026/3/lock').set('Authorization', `Bearer ${token}`);
    await request(app).post('/admin/months/2026/5/lock').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/admin/months')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].month).toBe(5); // newest first
    expect(res.body[1].month).toBe(3);
  });
});

// ── GET /admin/months/:year/:month/status ─────────────────────────────────────

describe('GET /admin/months/:year/:month/status', () => {
  it('returns is_locked=false and unapproved_week_count=0 for a fresh month', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/admin/months/2026/5/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.is_locked).toBe(false);
    expect(res.body.unapproved_week_count).toBe(0);
  });

  it('counts only non-approved weeks falling in the requested month', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);
    const user = await seedUser({ email: 'user@test.com', role: 'user' });

    // May 4 is in May, draft → counts as unapproved
    await seedWeeklySubmission(user.id, '2026-05-04', 'draft');
    // May 11 is in May, approved → does NOT count
    await seedWeeklySubmission(user.id, '2026-05-11', 'approved');
    // Apr 27 is in April → does NOT count even though unapproved
    await seedWeeklySubmission(user.id, '2026-04-27', 'submitted');

    const res = await request(app)
      .get('/admin/months/2026/5/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.unapproved_week_count).toBe(1);
  });

  it('returns is_locked=true and locked_by after locking', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app)
      .post('/admin/months/2026/5/lock')
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/admin/months/2026/5/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.is_locked).toBe(true);
    expect(res.body.locked_by).toBe(admin.id);
  });

  it('returns 400 for invalid year', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/admin/months/abc/5/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 for month out of range', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/admin/months/2026/13/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ── POST /admin/months/:year/:month/lock ──────────────────────────────────────

describe('POST /admin/months/:year/:month/lock', () => {
  it('locks a month — returns is_locked=true with locked_by and locked_at', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/admin/months/2026/5/lock')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.is_locked).toBe(true);
    expect(res.body.locked_by).toBe(admin.id);
    expect(res.body.locked_at).toBeTruthy();
    expect(res.body.year).toBe(2026);
    expect(res.body.month).toBe(5);
  });

  it('lock succeeds even when unapproved weeks exist — does NOT return 422', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);
    const user = await seedUser({ email: 'user@test.com', role: 'user' });

    await seedWeeklySubmission(user.id, '2026-05-04', 'submitted');

    const res = await request(app)
      .post('/admin/months/2026/5/lock')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.is_locked).toBe(true);
  });

  it('re-locking an already-locked month is idempotent', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app)
      .post('/admin/months/2026/5/lock')
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/admin/months/2026/5/lock')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.is_locked).toBe(true);

    const count = await db('month_locks').where({ year: 2026, month: 5 }).count('id as n').first() as { n: string };
    expect(Number(count.n)).toBe(1); // only one row
  });

  it('records locked_by and locked_at in the DB', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app)
      .post('/admin/months/2026/5/lock')
      .set('Authorization', `Bearer ${token}`);

    const row = await db('month_locks').where({ year: 2026, month: 5 }).first();
    expect(row.locked_by).toBe(admin.id);
    expect(row.locked_at).toBeTruthy();
    expect(isNaN(new Date(row.locked_at).getTime())).toBe(false);
  });

  it('writes a LOCK audit log entry with the actor id', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app)
      .post('/admin/months/2026/5/lock')
      .set('Authorization', `Bearer ${token}`);

    await sleep(80);

    const log = await db('audit_logs')
      .where({ actor_user_id: admin.id, action: 'LOCK', target_entity_type: 'MONTH_LOCK' })
      .first();

    expect(log).toBeTruthy();
  });

  it('fans out LOCKED_MONTH notifications to all active users only', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);
    await seedUser({ email: 'user1@test.com', role: 'user', isActive: true });
    await seedUser({ email: 'user2@test.com', role: 'user', isActive: true });
    await seedUser({ email: 'inactive@test.com', role: 'user', isActive: false });

    await request(app)
      .post('/admin/months/2026/5/lock')
      .set('Authorization', `Bearer ${token}`);

    await sleep(100);

    const notifications = await db('notifications').where({ type: 'LOCKED_MONTH' });
    // 3 active users (admin + user1 + user2), inactive excluded
    expect(notifications).toHaveLength(3);
    expect(notifications.every((n: { type: string }) => n.type === 'LOCKED_MONTH')).toBe(true);
  });
});

// ── POST /admin/months/:year/:month/unlock ────────────────────────────────────

describe('POST /admin/months/:year/:month/unlock', () => {
  it('returns 422 when reason is missing from body', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app).post('/admin/months/2026/5/lock').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/admin/months/2026/5/unlock')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it('returns 422 when reason is an empty string', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app).post('/admin/months/2026/5/lock').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/admin/months/2026/5/unlock')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: '' });

    expect(res.status).toBe(422);
  });

  it('returns 422 when reason is whitespace only', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app).post('/admin/months/2026/5/lock').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/admin/months/2026/5/unlock')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: '   ' });

    expect(res.status).toBe(422);
  });

  it('returns 422 when the month is not locked', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/admin/months/2026/5/unlock')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'correction needed' });

    expect(res.status).toBe(422);
  });

  it('unlocks a locked month — returns is_locked=false with unlocked_by', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app).post('/admin/months/2026/5/lock').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/admin/months/2026/5/unlock')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'correction needed' });

    expect(res.status).toBe(200);
    expect(res.body.is_locked).toBe(false);
    expect(res.body.unlocked_by).toBe(admin.id);
  });

  it('stores reason in month_locks.unlock_reason', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app).post('/admin/months/2026/5/lock').set('Authorization', `Bearer ${token}`);
    await request(app)
      .post('/admin/months/2026/5/unlock')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'payroll correction' });

    const row = await db('month_locks').where({ year: 2026, month: 5 }).first();
    expect(row.unlock_reason).toBe('payroll correction');
  });

  it('stores reason in audit_logs.reason (dual storage per spec)', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app).post('/admin/months/2026/5/lock').set('Authorization', `Bearer ${token}`);
    await request(app)
      .post('/admin/months/2026/5/unlock')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'payroll correction' });

    await sleep(80);

    const log = await db('audit_logs')
      .where({ action: 'UNLOCK', target_entity_type: 'MONTH_LOCK' })
      .first();

    expect(log).toBeTruthy();
    expect(log.reason).toBe('payroll correction');
    expect(log.actor_user_id).toBe(admin.id);
  });
});
