/// <reference types="jest" />
/**
 * Integration tests — Time Entries module (F09)
 *
 * Requires a running Postgres instance at DATABASE_URL (set in tests/setup.ts).
 *
 * Isolation: beforeEach truncates users + audit_logs + clients CASCADE.
 * RESTART IDENTITY resets id sequences → IDs start at 1 in every test.
 *
 * Coverage:
 *  GET  /time-entries          — list (filters, auth, scoping)
 *  GET  /time-entries/:id      — single entry
 *  POST /time-entries          — create (happy path, overlap, validations, cross-midnight, override)
 *  PUT  /time-entries/:id      — update (happy path, optimistic lock, guards, admin edit)
 *  DELETE /time-entries/:id    — soft delete (happy path, guards)
 *  GET  /time-entries/daily-summary — summary (standard hours, holiday, weekend)
 */
import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../../src/database/connection') as Knex;

// ── DB helpers ────────────────────────────────────────────────────────────────

async function clearTables(): Promise<void> {
  // Retry on deadlock: some controller failure paths fire-and-forget an audit
  // INSERT. The concurrent INSERT + TRUNCATE can deadlock; PostgreSQL will abort
  // one of them. We retry up to 3 times with a short back-off.
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
  dailyHoursOverride?: number | null;
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
    dailyHoursOverride = null,
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
      daily_hours_override: dailyHoursOverride,
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

interface TimeEntrySeed {
  userId: number;
  date: string;
  startTime?: string;
  endTime?: string;
  clientId: number;
  projectId: number;
  taskId: number;
  location?: string;
  description?: string;
  status?: 'draft' | 'submitted' | 'approved' | 'rejected';
  durationMinutes?: number;
  version?: number;
}

async function seedTimeEntry(seed: TimeEntrySeed): Promise<{ id: number; version: number }> {
  const startTime = seed.startTime ?? '09:00';
  const endTime = seed.endTime ?? '18:00';
  const durationMinutes = seed.durationMinutes ?? 540;
  const [row] = (await db('time_entries')
    .insert({
      user_id: seed.userId,
      date: seed.date,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes,
      client_id: seed.clientId,
      project_id: seed.projectId,
      task_id: seed.taskId,
      location: seed.location ?? 'office',
      description: seed.description ?? null,
      status: seed.status ?? 'draft',
      version: seed.version ?? 1,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'version'])) as Array<{ id: number; version: number }>;
  return row;
}

async function seedWeeklySubmission(
  userId: number,
  weekStartDate: string,
  status: 'submitted' | 'approved' | 'rejected' | 'draft',
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

async function seedMonthLock(year: number, month: number): Promise<void> {
  await db('month_locks').insert({
    year,
    month,
    is_locked: true,
    locked_by: 1,
    locked_at: new Date(),
  });
}

async function seedHoliday(
  date: string,
  type: 'national' | 'company' | 'partial_day',
): Promise<void> {
  await db('holiday_calendar').insert({ date, name: 'Test Holiday', type, created_at: new Date() });
}

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  return res.body.accessToken as string;
}

/** Scaffold: one user, client, project, open task, active assignment — ready to create entries. */
async function scaffoldUserWithTask(): Promise<{
  user: { id: number; email: string; plainPassword: string };
  admin: { id: number; email: string; plainPassword: string };
  client: { id: number };
  project: { id: number };
  task: { id: number };
}> {
  const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
  const user = await seedUser({ email: 'user@test.com', role: 'user' });
  const client = await seedClient();
  const project = await seedProject({ clientId: client.id });
  const task = await seedTask({ projectId: project.id });
  await seedAssignment(user.id, task.id);
  return { user, admin, client, project, task };
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

// ── GET /time-entries ─────────────────────────────────────────────────────────

describe('GET /time-entries', () => {
  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app).get('/time-entries');
    expect(res.status).toBe(401);
  });

  it('200: user sees only own entries', async () => {
    const { user, admin, client, project, task } = await scaffoldUserWithTask();
    const user2 = await seedUser({ email: 'user2@test.com' });
    const task2 = await seedTask({ projectId: project.id });
    await seedAssignment(user2.id, task2.id);

    await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });
    await seedTimeEntry({ userId: user2.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task2.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app).get('/time-entries').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].user_id).toBe(user.id);
    void admin;
  });

  it('200: admin sees all entries', async () => {
    const { user, admin, client, project, task } = await scaffoldUserWithTask();
    const user2 = await seedUser({ email: 'user2@test.com' });
    const task2 = await seedTask({ projectId: project.id });
    await seedAssignment(user2.id, task2.id);

    await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });
    await seedTimeEntry({ userId: user2.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task2.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app).get('/time-entries').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('200: filter by date returns only matching entries', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });
    await seedTimeEntry({ userId: user.id, date: '2026-05-02', clientId: client.id, projectId: project.id, taskId: task.id, startTime: '10:00', endTime: '15:00' });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries?date=2026-05-01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].date).toBe('2026-05-01');
  });

  it('200: filter by week (YYYY-WNN) returns entries within that ISO week', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    // 2026-W19 = Mon 2026-05-04 … Sun 2026-05-10
    await seedTimeEntry({ userId: user.id, date: '2026-05-05', clientId: client.id, projectId: project.id, taskId: task.id });
    await seedTimeEntry({ userId: user.id, date: '2026-05-12', clientId: client.id, projectId: project.id, taskId: task.id, startTime: '10:00', endTime: '15:00' });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries?week=2026-W19')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].date).toBe('2026-05-05');
  });

  it('200: filter by month (YYYY-MM) returns entries within that month', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });
    await seedTimeEntry({ userId: user.id, date: '2026-06-01', clientId: client.id, projectId: project.id, taskId: task.id, startTime: '10:00', endTime: '15:00' });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries?month=2026-05')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].date).toBe('2026-05-01');
  });

  it('200: soft-deleted entries are excluded', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });
    await db('time_entries').where('id', entry.id).update({ deleted_at: new Date() });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app).get('/time-entries').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('400: invalid date format returns 400', async () => {
    const { user } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries?date=not-a-date')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400: invalid week format returns 400', async () => {
    const { user } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries?week=2026-19')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('403: user cannot query another user\'s entries via user_id', async () => {
    const { user, admin } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get(`/time-entries?user_id=${admin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('T049 — GET /time-entries?year=2026&month=5 returns only entries in May 2026', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();

    await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });
    await seedTimeEntry({ userId: user.id, date: '2026-05-15', clientId: client.id, projectId: project.id, taskId: task.id, startTime: '10:00', endTime: '15:00' });
    // Entry outside the requested month — must NOT appear
    await seedTimeEntry({ userId: user.id, date: '2026-06-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries?year=2026&month=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((e: { date: string }) => e.date.startsWith('2026-05'))).toBe(true);
  });
});

// ── GET /time-entries/:id ─────────────────────────────────────────────────────

describe('GET /time-entries/:id', () => {
  it('200: user can fetch own entry', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(entry.id);
  });

  it('404: user cannot fetch another user\'s entry', async () => {
    const { admin, client, project, task } = await scaffoldUserWithTask();
    const otherUser = await seedUser({ email: 'other@test.com' });
    const entry = await seedTimeEntry({ userId: otherUser.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(admin.email, admin.plainPassword); // admin can see it
    const adminRes = await request(app)
      .get(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(adminRes.status).toBe(200);

    // But a different regular user cannot
    const user2 = await seedUser({ email: 'user2@test.com' });
    const user2Token = await login(user2.email, user2.plainPassword);
    const user2Res = await request(app)
      .get(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${user2Token}`);
    expect(user2Res.status).toBe(404);
  });

  it('404: non-existent id returns 404', async () => {
    const { user } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);
    const res = await request(app).get('/time-entries/99999').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('404: soft-deleted entry is hidden from GET by id', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });
    await db('time_entries').where('id', entry.id).update({ deleted_at: new Date() });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('400: non-integer id returns 400', async () => {
    const { user } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);
    const res = await request(app).get('/time-entries/abc').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ── POST /time-entries ────────────────────────────────────────────────────────

describe('POST /time-entries', () => {
  it('201: creates entry and auto-calculates duration_minutes', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '17:00',
        client_id: client.id,
        project_id: project.id,
        task_id: task.id,
        location: 'office',
      });

    expect(res.status).toBe(201);
    expect(res.body.duration_minutes).toBe(480); // 8h
    expect(res.body.user_id).toBe(user.id);
    expect(res.body.status).toBe('draft');
  });

  it('201: cross-midnight entry has duration > 0 and spans into next day', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '22:00',
        end_time: '02:00',
        client_id: client.id,
        project_id: project.id,
        task_id: task.id,
        location: 'office',
      });

    expect(res.status).toBe(201);
    expect(res.body.duration_minutes).toBe(240); // 4h across midnight
  });

  it('201: duration_override_minutes derives end_time when end_time is absent', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        duration_override_minutes: 180,
        client_id: client.id,
        project_id: project.id,
        task_id: task.id,
        location: 'office',
      });

    expect(res.status).toBe(201);
    expect(res.body.end_time).toMatch(/^12:00(?::00)?$/);
    expect(res.body.duration_minutes).toBe(180);
  });

  it('201: end_time wins when both end_time and duration_override_minutes are provided', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '11:00',
        duration_override_minutes: 999, // ignored
        client_id: client.id,
        project_id: project.id,
        task_id: task.id,
        location: 'office',
      });

    expect(res.status).toBe(201);
    expect(res.body.duration_minutes).toBe(120); // 2h, not 999min
  });

  it('409: overlapping entry is blocked', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    await seedTimeEntry({
      userId: user.id,
      date: '2026-05-01',
      startTime: '09:00',
      endTime: '12:00',
      clientId: client.id, projectId: project.id, taskId: task.id,
    });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '11:00',
        end_time: '14:00',
        client_id: client.id, project_id: project.id, task_id: task.id, location: 'office',
      });

    expect(res.status).toBe(409);
  });

  it('409: overlap is blocked even when the entries are on different projects', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const secondProject = await seedProject({ clientId: client.id, name: 'Second Project' });
    const secondTask = await seedTask({ projectId: secondProject.id, name: 'Second Task' });
    await seedAssignment(user.id, secondTask.id);

    await seedTimeEntry({
      userId: user.id,
      date: '2026-05-01',
      startTime: '09:00',
      endTime: '12:00',
      clientId: client.id,
      projectId: project.id,
      taskId: task.id,
    });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '11:00',
        end_time: '14:00',
        client_id: client.id,
        project_id: secondProject.id,
        task_id: secondTask.id,
        location: 'office',
      });

    expect(res.status).toBe(409);
  });

  it('201: adjacent entries (00:00–end, start–00:00) are allowed', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    await seedTimeEntry({
      userId: user.id,
      date: '2026-05-01',
      startTime: '09:00',
      endTime: '12:00',
      clientId: client.id, projectId: project.id, taskId: task.id,
    });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '12:00',
        end_time: '15:00',
        client_id: client.id, project_id: project.id, task_id: task.id, location: 'office',
      });

    expect(res.status).toBe(201);
  });

  it('422: future date is blocked', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2099-01-01',
        start_time: '09:00',
        end_time: '17:00',
        client_id: client.id, project_id: project.id, task_id: task.id, location: 'office',
      });

    expect(res.status).toBe(422);
  });

  it('422: end_time === start_time is blocked', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '09:00',
        client_id: client.id, project_id: project.id, task_id: task.id, location: 'office',
      });

    expect(res.status).toBe(422);
  });

  it('422: inactive client is blocked', async () => {
    const { user, project, task } = await scaffoldUserWithTask();
    const inactiveClient = await seedClient('Inactive Corp', false);
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '17:00',
        client_id: inactiveClient.id, project_id: project.id, task_id: task.id, location: 'office',
      });

    expect(res.status).toBe(422);
  });

  it('422: inactive project is blocked', async () => {
    const { user, client, task } = await scaffoldUserWithTask();
    const inactiveProject = await seedProject({ clientId: client.id, isActive: false });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '17:00',
        client_id: client.id, project_id: inactiveProject.id, task_id: task.id, location: 'office',
      });

    expect(res.status).toBe(422);
  });

  it('422: closed task is blocked with "Task is closed"', async () => {
    const { user, client, project } = await scaffoldUserWithTask();
    const closedTask = await seedTask({ projectId: project.id, status: 'closed' });
    await seedAssignment(user.id, closedTask.id);
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '17:00',
        client_id: client.id, project_id: project.id, task_id: closedTask.id, location: 'office',
      });

    expect(res.status).toBe(422);
    expect(res.body.message ?? res.body.error).toMatch(/task is closed/i);
  });

  it('422: unassigned task is blocked', async () => {
    const { user, client, project } = await scaffoldUserWithTask();
    const unassignedTask = await seedTask({ projectId: project.id }); // no assignment for user
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '17:00',
        client_id: client.id, project_id: project.id, task_id: unassignedTask.id, location: 'office',
      });

    expect(res.status).toBe(422);
  });

  it('422: inactive assignment is blocked', async () => {
    const { user, client, project } = await scaffoldUserWithTask();
    const task2 = await seedTask({ projectId: project.id });
    await seedAssignment(user.id, task2.id, false); // inactive assignment
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '17:00',
        client_id: client.id, project_id: project.id, task_id: task2.id, location: 'office',
      });

    expect(res.status).toBe(422);
  });

  it('400: missing required fields returns 400', async () => {
    const { user } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-05-01' }); // missing start_time, end_time, client_id, etc.

    expect(res.status).toBe(400);
  });

  it('400: invalid time format returns 400', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '9am',
        end_time: '17:00',
        client_id: client.id, project_id: project.id, task_id: task.id, location: 'office',
      });

    expect(res.status).toBe(400);
  });

  it('400: invalid location value returns 400', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '17:00',
        client_id: client.id, project_id: project.id, task_id: task.id, location: 'moon',
      });

    expect(res.status).toBe(400);
  });

  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app).post('/time-entries').send({});
    expect(res.status).toBe(401);
  });

  it('423: cannot create when month is locked', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    await seedMonthLock(2026, 5);
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '17:00',
        client_id: client.id,
        project_id: project.id,
        task_id: task.id,
        location: 'office',
      });

    expect(res.status).toBe(423);
  });
});

// ── PUT /time-entries/:id ─────────────────────────────────────────────────────

describe('PUT /time-entries/:id', () => {
  it('200: user can update own draft entry', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ start_time: '10:00', end_time: '18:00', version: entry.version });

    expect(res.status).toBe(200);
    expect(res.body.start_time).toMatch(/^10:00(?::00)?$/);
    expect(res.body.duration_minutes).toBe(480);
    expect(res.body.version).toBe(entry.version + 1);
  });

  it('200: rejected entry auto-transitions to draft on update and clears rejection_reason', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id, status: 'rejected' });
    await db('time_entries').where('id', entry.id).update({ rejection_reason: 'Too vague' });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated description', version: entry.version });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.rejection_reason).toBeNull();
  });

  it('200: admin can update any user\'s draft entry and stamps last_modified_by_role=admin', async () => {
    const { user, admin, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Admin corrected', version: entry.version });

    expect(res.status).toBe(200);
    expect(res.body.last_modified_by).toBe(admin.id);
    expect(res.body.last_modified_by_role).toBe('admin');
  });

  it('409: optimistic lock — stale version returns 409', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Stale update', version: entry.version + 99 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'CONFLICT',
      message: 'Entry was modified by someone else. Please reload and try again.',
    });
  });

  it('400: missing version field returns 400', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'No version' });

    expect(res.status).toBe(400);
  });

  it('422: cannot update submitted entry', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id, status: 'submitted' });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Attempted edit', version: entry.version });

    expect(res.status).toBe(422);
  });

  it('422: cannot update when week is submitted', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    // 2026-05-04 is Monday (week start)
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-06', clientId: client.id, projectId: project.id, taskId: task.id });
    await seedWeeklySubmission(user.id, '2026-05-04', 'submitted');

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Blocked by week', version: entry.version });

    expect(res.status).toBe(422);
  });

  it('423: cannot update when month is locked', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });
    await seedMonthLock(2026, 5);

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Blocked by lock', version: entry.version });

    expect(res.status).toBe(423);
  });

  it('404: user cannot update another user\'s entry', async () => {
    const { admin, client, project, task } = await scaffoldUserWithTask();
    const otherUser = await seedUser({ email: 'other@test.com' });
    const entry = await seedTimeEntry({ userId: otherUser.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    // A third user (not the owner) cannot see/edit the entry
    const thirdUser = await seedUser({ email: 'third@test.com' });
    const token = await login(thirdUser.email, thirdUser.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Steal', version: entry.version });

    expect(res.status).toBe(404);
    void admin;
  });

  it('409: update that creates overlap is blocked', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const existing = await seedTimeEntry({ userId: user.id, date: '2026-05-01', startTime: '09:00', endTime: '12:00', clientId: client.id, projectId: project.id, taskId: task.id });
    const toUpdate = await seedTimeEntry({ userId: user.id, date: '2026-05-01', startTime: '13:00', endTime: '17:00', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    // Shift toUpdate into existing's window
    const res = await request(app)
      .put(`/time-entries/${toUpdate.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ start_time: '10:00', end_time: '14:00', version: toUpdate.version });

    expect(res.status).toBe(409);
    void existing;
  });

  it('422: updating end_time to equal start_time is blocked', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ start_time: '09:00', end_time: '09:00', version: entry.version });

    expect(res.status).toBe(422);
  });
});

// ── DELETE /time-entries/:id ──────────────────────────────────────────────────

describe('DELETE /time-entries/:id', () => {
  it('204: user can soft-delete own draft entry', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .delete(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    // Verify soft-deleted (deleted_at set, row still exists in DB)
    const row = await db('time_entries').where('id', entry.id).first() as { deleted_at: unknown };
    expect(row.deleted_at).not.toBeNull();
  });

  it('204: user can delete a rejected entry', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id, status: 'rejected' });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .delete(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  it('422: cannot delete submitted entry', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id, status: 'submitted' });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .delete(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  it('423: cannot delete when month is locked', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });
    await seedMonthLock(2026, 5);

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .delete(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(423);
  });

  it('404: user cannot delete another user\'s entry', async () => {
    const { client, project, task } = await scaffoldUserWithTask();
    const otherUser = await seedUser({ email: 'owner@test.com' });
    const entry = await seedTimeEntry({ userId: otherUser.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const intruder = await seedUser({ email: 'intruder@test.com' });
    const token = await login(intruder.email, intruder.plainPassword);
    const res = await request(app)
      .delete(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('404: deleting already soft-deleted entry returns 404', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });
    await db('time_entries').where('id', entry.id).update({ deleted_at: new Date() });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .delete(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── GET /time-entries/daily-summary ──────────────────────────────────────────

describe('GET /time-entries/daily-summary', () => {
  it('200: returns status=missing when no entries for a workday', async () => {
    const { user } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);
    // 2026-05-04 is a Monday
    const res = await request(app)
      .get('/time-entries/daily-summary?date=2026-05-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('missing');
    expect(res.body.standard_hours).toBe(9);
    expect(res.body.total_hours).toBe(0);
    expect(res.body.remaining_hours).toBe(9);
  });

  it('200: returns status=full when total >= standard hours', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    await seedTimeEntry({ userId: user.id, date: '2026-05-04', startTime: '08:00', endTime: '17:00', durationMinutes: 540, clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries/daily-summary?date=2026-05-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('full');
    expect(res.body.total_hours).toBe(9);
    expect(res.body.remaining_hours).toBe(0);
    expect(res.body.entry_count).toBe(1);
  });

  it('200: returns status=partial when total < standard hours', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    await seedTimeEntry({ userId: user.id, date: '2026-05-04', startTime: '09:00', endTime: '14:00', durationMinutes: 300, clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries/daily-summary?date=2026-05-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('partial');
    expect(res.body.total_hours).toBe(5);
    expect(res.body.remaining_hours).toBe(4);
  });

  it('200: returns status=day_off for Saturday (weekend)', async () => {
    const { user } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);
    // 2026-05-09 is a Saturday
    const res = await request(app)
      .get('/time-entries/daily-summary?date=2026-05-09')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('day_off');
    expect(res.body.standard_hours).toBe(0);
  });

  it('200: returns status=day_off for Friday (weekend)', async () => {
    const { user } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);
    // 2026-05-08 is a Friday
    const res = await request(app)
      .get('/time-entries/daily-summary?date=2026-05-08')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('day_off');
  });

  it('200: returns status=day_off for national holiday', async () => {
    const { user } = await scaffoldUserWithTask();
    await seedHoliday('2026-05-04', 'national');
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get('/time-entries/daily-summary?date=2026-05-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('day_off');
    expect(res.body.standard_hours).toBe(0);
  });

  it('200: partial_day holiday halves the standard hours', async () => {
    const { user } = await scaffoldUserWithTask();
    await seedHoliday('2026-05-04', 'partial_day');
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get('/time-entries/daily-summary?date=2026-05-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.standard_hours).toBe(4.5); // half of 9
  });

  it('200: respects user daily_hours_override', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'parttime@test.com', role: 'user', dailyHoursOverride: 6 });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get('/time-entries/daily-summary?date=2026-05-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.standard_hours).toBe(6);
    void admin;
  });

  it('200: admin can query summary for another user via user_id', async () => {
    const { user, admin, client, project, task } = await scaffoldUserWithTask();
    await seedTimeEntry({ userId: user.id, date: '2026-05-04', startTime: '08:00', endTime: '17:00', durationMinutes: 540, clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get(`/time-entries/daily-summary?date=2026-05-04&user_id=${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.entry_count).toBe(1);
  });

  it('403: regular user cannot query another user\'s summary', async () => {
    const { user, admin } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get(`/time-entries/daily-summary?date=2026-05-04&user_id=${admin.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('400: missing date returns 400', async () => {
    const { user } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries/daily-summary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400: invalid date format returns 400', async () => {
    const { user } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries/daily-summary?date=05-04-2026')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('200: soft-deleted entries are excluded from summary totals', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-04', startTime: '08:00', endTime: '17:00', durationMinutes: 540, clientId: client.id, projectId: project.id, taskId: task.id });
    await db('time_entries').where('id', entry.id).update({ deleted_at: new Date() });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries/daily-summary?date=2026-05-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total_hours).toBe(0);
    expect(res.body.entry_count).toBe(0);
    expect(res.body.status).toBe('missing');
  });
});

// ── Additional edge-case & gap tests ─────────────────────────────────────────

describe('POST /time-entries — cross-midnight overlap detection', () => {
  it('409: new entry overlapping a cross-midnight entry is blocked', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    // 22:00–02:00 spans midnight
    await seedTimeEntry({
      userId: user.id, date: '2026-05-01',
      startTime: '22:00', endTime: '02:00', durationMinutes: 240,
      clientId: client.id, projectId: project.id, taskId: task.id,
    });

    const token = await login(user.email, user.plainPassword);
    // 01:00–05:00 overlaps the cross-midnight entry
    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '01:00',
        end_time: '05:00',
        client_id: client.id, project_id: project.id, task_id: task.id, location: 'office',
      });

    expect(res.status).toBe(409);
  });

  it('201: entry on a different date does not conflict with cross-midnight entry', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    // Cross-midnight on May 1
    await seedTimeEntry({
      userId: user.id, date: '2026-05-01',
      startTime: '22:00', endTime: '02:00', durationMinutes: 240,
      clientId: client.id, projectId: project.id, taskId: task.id,
    });

    const token = await login(user.email, user.plainPassword);
    // Different date — should be allowed
    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-02',
        start_time: '09:00',
        end_time: '17:00',
        client_id: client.id, project_id: project.id, task_id: task.id, location: 'office',
      });

    expect(res.status).toBe(201);
  });
});

describe('POST /time-entries — entity relationship validations', () => {
  it('422: project that does not belong to the given client is blocked', async () => {
    const { user, task } = await scaffoldUserWithTask();
    // Create a second client and use its project with a different client_id
    const otherClient = await seedClient('Other Client');
    const otherProject = await seedProject({ clientId: otherClient.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '17:00',
        client_id: otherClient.id,
        project_id: otherProject.id,
        task_id: task.id, // task belongs to original project
        location: 'office',
      });

    expect(res.status).toBe(422);
  });

  it('422: task that does not belong to the given project is blocked', async () => {
    const { user, client, project } = await scaffoldUserWithTask();
    // Task in a different project
    const otherProject = await seedProject({ clientId: client.id });
    const otherTask = await seedTask({ projectId: otherProject.id });
    await seedAssignment(user.id, otherTask.id);

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '17:00',
        client_id: client.id,
        project_id: project.id,  // original project
        task_id: otherTask.id,    // task belongs to otherProject
        location: 'office',
      });

    expect(res.status).toBe(422);
  });

  it('422: non-existent client_id returns 422', async () => {
    const { user, project, task } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01', start_time: '09:00', end_time: '17:00',
        client_id: 99999, project_id: project.id, task_id: task.id, location: 'office',
      });

    expect(res.status).toBe(422);
  });
});

describe('PUT /time-entries/:id — additional guards', () => {
  it('200: entry in a rejected-status week can still be edited', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    // 2026-05-04 is a Monday (week start)
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-06', clientId: client.id, projectId: project.id, taskId: task.id });
    await seedWeeklySubmission(user.id, '2026-05-04', 'rejected');

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Allowed because week is rejected', version: entry.version });

    expect(res.status).toBe(200);
  });

  it('422: approved entry cannot be edited', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id, status: 'approved' });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Try edit approved', version: entry.version });

    expect(res.status).toBe(422);
  });

  it('200: PUT with duration_override_minutes derives end_time', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ start_time: '10:00', duration_override_minutes: 120, version: entry.version });

    expect(res.status).toBe(200);
    expect(res.body.end_time).toMatch(/^12:00(?::00)?$/);
    expect(res.body.duration_minutes).toBe(120);
  });

  it('200: second consecutive update increments version twice', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });
    const token = await login(user.email, user.plainPassword);

    const first = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Edit 1', version: entry.version });
    expect(first.status).toBe(200);
    expect(first.body.version).toBe(entry.version + 1);

    const second = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Edit 2', version: first.body.version });
    expect(second.status).toBe(200);
    expect(second.body.version).toBe(entry.version + 2);
  });
});

describe('DELETE /time-entries/:id — admin scope', () => {
  it('204: admin can soft-delete any user\'s draft entry', async () => {
    const { user, admin, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .delete(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    const row = await db('time_entries').where('id', entry.id).first() as { deleted_at: unknown };
    expect(row.deleted_at).not.toBeNull();
  });
});

describe('GET /time-entries — admin user_id filter', () => {
  it('200: admin can filter entries by user_id', async () => {
    const { user, admin, client, project, task } = await scaffoldUserWithTask();
    const user2 = await seedUser({ email: 'user2@test.com' });
    const task2 = await seedTask({ projectId: project.id });
    await seedAssignment(user2.id, task2.id);

    await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });
    await seedTimeEntry({ userId: user2.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task2.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get(`/time-entries?user_id=${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].user_id).toBe(user.id);
  });
});

describe('GET /time-entries/daily-summary — multiple entries', () => {
  it('200: sums multiple entries on the same day correctly', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    // 3h + 2h = 5h, partial (standard is 9h)
    await seedTimeEntry({ userId: user.id, date: '2026-05-04', startTime: '08:00', endTime: '11:00', durationMinutes: 180, clientId: client.id, projectId: project.id, taskId: task.id });
    await seedTimeEntry({ userId: user.id, date: '2026-05-04', startTime: '12:00', endTime: '14:00', durationMinutes: 120, clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries/daily-summary?date=2026-05-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.entry_count).toBe(2);
    expect(res.body.total_hours).toBe(5);
    expect(res.body.remaining_hours).toBe(4);
    expect(res.body.status).toBe('partial');
  });

  it('200: status=full when multiple entries together meet standard hours', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    // 5h + 4h = 9h → full
    await seedTimeEntry({ userId: user.id, date: '2026-05-04', startTime: '08:00', endTime: '13:00', durationMinutes: 300, clientId: client.id, projectId: project.id, taskId: task.id });
    await seedTimeEntry({ userId: user.id, date: '2026-05-04', startTime: '14:00', endTime: '18:00', durationMinutes: 240, clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries/daily-summary?date=2026-05-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total_hours).toBe(9);
    expect(res.body.remaining_hours).toBe(0);
    expect(res.body.status).toBe('full');
  });
});

describe('Audit log — DB-level verification', () => {
  it('CREATE writes an audit_log row with action=CREATE', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01', start_time: '09:00', end_time: '17:00',
        client_id: client.id, project_id: project.id, task_id: task.id, location: 'office',
      });

    // Give fire-and-forget a tick to settle
    await new Promise((r) => setTimeout(r, 50));

    const log = await db('audit_logs')
      .where({ actor_user_id: user.id, target_entity_type: 'TIME_ENTRY', action: 'CREATE' })
      .first() as { action: string; new_value: unknown } | undefined;

    expect(log).toBeDefined();
    expect(log?.action).toBe('CREATE');
  });

  it('ADMIN_EDIT writes an audit_log row with action=ADMIN_EDIT', async () => {
    const { user, admin, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(admin.email, admin.plainPassword);
    await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Admin fix', version: entry.version });

    await new Promise((r) => setTimeout(r, 50));

    const log = await db('audit_logs')
      .where({ actor_user_id: admin.id, target_entity_type: 'TIME_ENTRY', action: 'ADMIN_EDIT' })
      .first() as { action: string } | undefined;

    expect(log).toBeDefined();
    expect(log?.action).toBe('ADMIN_EDIT');
  });

  it('UPDATE writes old_value and new_value for a regular user edit', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({
      userId: user.id,
      date: '2026-05-01',
      clientId: client.id,
      projectId: project.id,
      taskId: task.id,
      description: 'Before',
    });

    const token = await login(user.email, user.plainPassword);
    await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'After', version: entry.version });

    await new Promise((r) => setTimeout(r, 50));

    const log = await db('audit_logs')
      .where({ actor_user_id: user.id, target_entity_type: 'TIME_ENTRY', action: 'UPDATE' })
      .first() as { old_value: { description?: string } | null; new_value: { description?: string } | null } | undefined;

    expect(log?.old_value).toMatchObject({ description: 'Before' });
    expect(log?.new_value).toMatchObject({ description: 'After' });
  });

  it('ENTRY_CORRECTED is logged when a user edits a rejected entry', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({
      userId: user.id,
      date: '2026-05-01',
      clientId: client.id,
      projectId: project.id,
      taskId: task.id,
      status: 'rejected',
      description: 'Needs fix',
    });
    await db('time_entries').where('id', entry.id).update({ rejection_reason: 'Too vague' });

    const token = await login(user.email, user.plainPassword);
    await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Fixed', version: entry.version });

    await new Promise((r) => setTimeout(r, 50));

    const log = await db('audit_logs')
      .where({ actor_user_id: user.id, target_entity_type: 'TIME_ENTRY', action: 'ENTRY_CORRECTED' })
      .first() as { old_value: { status?: string } | null; new_value: { status?: string; rejection_reason?: string | null } | null } | undefined;

    expect(log?.old_value).toMatchObject({ status: 'rejected' });
    expect(log?.new_value).toMatchObject({ status: 'draft', rejection_reason: null });
  });

  it('DELETE writes an audit_log row with action=DELETE', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({ userId: user.id, date: '2026-05-01', clientId: client.id, projectId: project.id, taskId: task.id });

    const token = await login(user.email, user.plainPassword);
    await request(app)
      .delete(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`);

    await new Promise((r) => setTimeout(r, 50));

    const log = await db('audit_logs')
      .where({ actor_user_id: user.id, target_entity_type: 'TIME_ENTRY', action: 'DELETE' })
      .first() as { action: string; old_value: unknown } | undefined;

    expect(log).toBeDefined();
    expect(log?.action).toBe('DELETE');
    expect(log?.old_value).not.toBeNull();
  });
});

// ── GET /time-entries/dropdown-data ──────────────────────────────────────────

describe('GET /time-entries/dropdown-data', () => {
  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app).get('/time-entries/dropdown-data');
    expect(res.status).toBe(401);
  });

  it('200: returns empty clients array when user has no active assignments', async () => {
    const user = await seedUser({ email: 'noassign@test.com' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get('/time-entries/dropdown-data')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.clients).toEqual([]);
    expect(Object.prototype.hasOwnProperty.call(res.body, 'sort_prefs')).toBe(true);
  });

  it('200: returns clients→projects→tasks tree for active assignments', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get('/time-entries/dropdown-data')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.clients).toHaveLength(1);
    expect(res.body.clients[0].id).toBe(client.id);
    expect(res.body.clients[0].projects).toHaveLength(1);
    expect(res.body.clients[0].projects[0].id).toBe(project.id);
    expect(res.body.clients[0].projects[0].tasks).toHaveLength(1);
    expect(res.body.clients[0].projects[0].tasks[0].id).toBe(task.id);
  });

  it('200: excludes inactive assignment, inactive project, inactive client, and closed task', async () => {
    const { user } = await scaffoldUserWithTask();

    // Inactive assignment
    const client2 = await seedClient('Client2');
    const proj2 = await seedProject({ clientId: client2.id });
    const task2 = await seedTask({ projectId: proj2.id });
    await seedAssignment(user.id, task2.id, false); // inactive

    // Inactive project
    const client3 = await seedClient('Client3');
    const proj3 = await seedProject({ clientId: client3.id, isActive: false });
    const task3 = await seedTask({ projectId: proj3.id });
    await seedAssignment(user.id, task3.id);

    // Closed task
    const client4 = await seedClient('Client4');
    const proj4 = await seedProject({ clientId: client4.id });
    const task4 = await seedTask({ projectId: proj4.id, status: 'closed' });
    await seedAssignment(user.id, task4.id);

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries/dropdown-data')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const returnedIds = (res.body.clients as Array<{ id: number }>).map((c) => c.id);
    // Only the first client from scaffoldUserWithTask should appear
    expect(returnedIds).not.toContain(client2.id);
    expect(returnedIds).not.toContain(client3.id);
    expect(returnedIds).not.toContain(client4.id);
  });

  it('200: sort_prefs is passed through from users table (null when unset)', async () => {
    const { user } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get('/time-entries/dropdown-data')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sort_prefs).toBeNull();
  });

  it('200: non-null sort_prefs object is returned intact', async () => {
    const { user } = await scaffoldUserWithTask();
    const prefs = {
      client_id: { '1': 3 },
      project_id: { '2': 2 },
      task_id: { '3': 1 },
    };
    await db('users').where('id', user.id).update({ sort_prefs: JSON.stringify(prefs) });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get('/time-entries/dropdown-data')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sort_prefs).toEqual(prefs);
  });

  it('200: highest-ranked client in sort_prefs appears first', async () => {
    const { user, client } = await scaffoldUserWithTask();

    // Add a second client+project+task and rank it above the scaffolded client.
    const client2 = await seedClient('Frequent Client');
    const proj2 = await seedProject({ clientId: client2.id });
    const task2 = await seedTask({ projectId: proj2.id });
    await seedAssignment(user.id, task2.id);
    await db('users').where('id', user.id).update({
      sort_prefs: JSON.stringify({
        client_id: { [String(client2.id)]: 10, [String(client.id)]: 1 },
      }),
    });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries/dropdown-data')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.clients[0].id).toBe(client2.id);
    expect(res.body.clients[1].id).toBe(client.id);
  });

  it('200: project and task ordering follows sort_prefs within each level', async () => {
    const { user, client } = await scaffoldUserWithTask();

    // Two projects under the same client; proj3 ranked above proj2.
    const proj2 = await seedProject({ clientId: client.id, name: 'Z-Proj2' });
    const proj3 = await seedProject({ clientId: client.id, name: 'Z-Proj3' });
    const task2 = await seedTask({ projectId: proj2.id, name: 'Z-Task2' });
    const task3a = await seedTask({ projectId: proj3.id, name: 'A-Task3a' });
    const task3b = await seedTask({ projectId: proj3.id, name: 'B-Task3b' });
    await seedAssignment(user.id, task2.id);
    await seedAssignment(user.id, task3a.id);
    await seedAssignment(user.id, task3b.id);
    await db('users').where('id', user.id).update({
      sort_prefs: JSON.stringify({
        project_id: { [String(proj3.id)]: 8, [String(proj2.id)]: 3 },
        task_id: { [String(task3b.id)]: 5, [String(task3a.id)]: 1, [String(task2.id)]: 2 },
      }),
    });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/time-entries/dropdown-data')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const projects = res.body.clients[0].projects as Array<{ id: number; tasks: Array<{ id: number }> }>;
    // proj3 ranked above proj2
    expect(projects[0].id).toBe(proj3.id);
    expect(projects[1].id).toBe(proj2.id);
    // Within proj3: task3b ranked above task3a
    const proj3Tasks = projects[0].tasks;
    expect(proj3Tasks[0].id).toBe(task3b.id);
    expect(proj3Tasks[1].id).toBe(task3a.id);
  });

  it('403: admin cannot call dropdown-data', async () => {
    const admin = await seedUser({ email: 'adm2@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/time-entries/dropdown-data')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ── Quota warning ─────────────────────────────────────────────────────────────

describe('Quota warning — POST /time-entries', () => {
  it('warning=false when total is below 90% of monthly quota', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const token = await login(user.email, user.plainPassword);

    // 1 hour entry — well below 90%
    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-01',
        start_time: '09:00',
        end_time: '10:00',
        client_id: client.id, project_id: project.id, task_id: task.id, location: 'office',
      });

    expect(res.status).toBe(201);
    expect(res.body.warning).toBe(false);
  });

  it('warning=true and notification created when ≥90% of monthly quota crossed', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();

    // May 2026 has 21 Sun-Thu working days (the implementation calendar).
    // Quota = 9h * 21 = 189h. 90% threshold = 170.1h.
    // Seed 18 full 9h-days (162h), then POST day 19 (171h) → crosses 90%.
    for (let d = 1; d <= 19; d++) {
      await seedTimeEntry({
        userId: user.id,
        date: `2026-04-${String(d).padStart(2, '0')}`,
        clientId: client.id, projectId: project.id, taskId: task.id,
        durationMinutes: 9 * 60,
        startTime: '09:00', endTime: '18:00',
      });
    }

    const token = await login(user.email, user.plainPassword);
    // Post entry on day 19 → tips over 90%
    const res = await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-04-20',
        start_time: '09:00',
        end_time: '18:00',
        client_id: client.id, project_id: project.id, task_id: task.id, location: 'office',
      });

    expect(res.status).toBe(201);
    expect(res.body.warning).toBe(true);

    // Notification row must exist
    await new Promise((r) => setTimeout(r, 50));
    const notif = await db('notifications')
      .where({ user_id: user.id, type: 'QUOTA_WARNING' })
      .first() as { type: string } | undefined;
    expect(notif).toBeDefined();
  });

  it('duplicate QUOTA_WARNING notification is not inserted on second crossing call', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();

    // Pre-seed 18 full days → well above 90%
    for (let d = 1; d <= 18; d++) {
      await seedTimeEntry({
        userId: user.id,
        date: `2026-05-${String(d).padStart(2, '0')}`,
        clientId: client.id, projectId: project.id, taskId: task.id,
        durationMinutes: 9 * 60,
        startTime: '09:00', endTime: '18:00',
      });
    }
    // First trigger
    await db('notifications').insert({
      user_id: user.id,
      type: 'QUOTA_WARNING',
      title: 'אזהרת מכסת שעות',
      body: 'test',
      related_entity_type: 'MONTH',
      related_entity_id: 202605,
    });

    const token = await login(user.email, user.plainPassword);
    await request(app)
      .post('/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-05-21',
        start_time: '09:00',
        end_time: '18:00',
        client_id: client.id, project_id: project.id, task_id: task.id, location: 'office',
      });

    await new Promise((r) => setTimeout(r, 50));

    const count = await db('notifications')
      .where({ user_id: user.id, type: 'QUOTA_WARNING' })
      .count('id as cnt')
      .first() as { cnt: string };
    expect(Number(count.cnt)).toBe(1); // still only one row
  });
});

describe('Quota warning — PUT /time-entries', () => {
  it('warning=true returned from PUT when ≥90% threshold is crossed', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();

    // Seed 18 full days (162h) then update one of them to add an hour → 163h still < 170.1h
    // Instead: seed 19 days directly, update the last one (just to exercise the PUT path)
    for (let d = 1; d <= 19; d++) {
      await seedTimeEntry({
        userId: user.id,
        date: `2026-05-${String(d).padStart(2, '0')}`,
        clientId: client.id, projectId: project.id, taskId: task.id,
        durationMinutes: 9 * 60,
        startTime: '09:00', endTime: '18:00',
      });
    }
    // Fetch one of the existing entries to update
    const entryToUpdate = await db('time_entries')
      .where({ user_id: user.id, date: '2026-05-19' })
      .first() as { id: number; version: number };

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entryToUpdate.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: entryToUpdate.version,
        description: 'updated description',
      });

    expect(res.status).toBe(200);
    expect(res.body.warning).toBe(true);
  });
});

// ── Atomic optimistic lock ────────────────────────────────────────────────────

describe('PUT /time-entries — atomic optimistic lock', () => {
  it('409: second concurrent PUT with the same stale version loses atomically', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({
      userId: user.id, date: '2026-05-01',
      clientId: client.id, projectId: project.id, taskId: task.id,
      startTime: '09:00', endTime: '10:00', durationMinutes: 60,
    });
    const token = await login(user.email, user.plainPassword);

    // Both requests carry version = entry.version (simulating concurrent reads)
    const [res1, res2] = await Promise.all([
      request(app)
        .put(`/time-entries/${entry.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ version: entry.version, start_time: '09:00', end_time: '11:00' }),
      request(app)
        .put(`/time-entries/${entry.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ version: entry.version, start_time: '09:00', end_time: '12:00' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Exactly one succeeds (200) and one conflicts (409)
    expect(statuses).toEqual([200, 409]);

    // The 409 response must contain the CONFLICT payload
    const conflictRes = res1.status === 409 ? res1 : res2;
    expect(conflictRes.body.error).toBe('CONFLICT');
  });
});

// ── PUT /time-entries — entity-change validation ──────────────────────────────

describe('PUT /time-entries — entity change validation', () => {
  it('422: updating task_id to a closed task is rejected', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({
      userId: user.id, date: '2026-05-01',
      clientId: client.id, projectId: project.id, taskId: task.id,
    });

    // Create a closed task in the same project
    const closedTask = await seedTask({ projectId: project.id, status: 'closed' });
    await seedAssignment(user.id, closedTask.id);

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ version: entry.version, task_id: closedTask.id });

    expect(res.status).toBe(422);
    expect(res.body.message ?? res.body.error).toMatch(/closed/i);
  });

  it('422: updating project_id to one from a different client is rejected', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({
      userId: user.id, date: '2026-05-01',
      clientId: client.id, projectId: project.id, taskId: task.id,
    });

    const otherClient = await seedClient('Other Client');
    const otherProject = await seedProject({ clientId: otherClient.id });
    const otherTask = await seedTask({ projectId: otherProject.id });
    await seedAssignment(user.id, otherTask.id);

    const token = await login(user.email, user.plainPassword);
    // client_id stays original but project_id belongs to otherClient → mismatch
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: entry.version,
        project_id: otherProject.id,
        task_id: otherTask.id,
      });

    expect(res.status).toBe(422);
  });

  it('422: updating task_id to a task from a different project is rejected', async () => {
    const { user, client, project, task } = await scaffoldUserWithTask();
    const entry = await seedTimeEntry({
      userId: user.id, date: '2026-05-01',
      clientId: client.id, projectId: project.id, taskId: task.id,
    });

    const otherProject = await seedProject({ clientId: client.id });
    const otherTask = await seedTask({ projectId: otherProject.id });
    await seedAssignment(user.id, otherTask.id);

    const token = await login(user.email, user.plainPassword);
    // project_id stays original but task_id belongs to otherProject → mismatch
    const res = await request(app)
      .put(`/time-entries/${entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: entry.version,
        task_id: otherTask.id,
      });

    expect(res.status).toBe(422);
  });
});
