/// <reference types="jest" />
/**
 * Integration tests — Timer (F10)
 *
 * Requires a running Postgres instance at DATABASE_URL.
 * Isolation: beforeEach truncates users + audit_logs + clients CASCADE.
 *
 * Coverage:
 *  GET  /timer/status  — no timer, running timer, yesterday's open row
 *  POST /timer/start   — happy path, already running today, open row from yesterday
 *  POST /timer/stop    — happy path, no active timer, missing body fields
 *  Auth               — 401 on all endpoints without token
 */
import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../../src/database/connection') as Knex;

// ── DB helpers ────────────────────────────────────────────────────────────────

async function clearTables(): Promise<void> {
  await db.raw('TRUNCATE users, audit_logs, clients RESTART IDENTITY CASCADE');
}

async function seedUser(opts: {
  email?: string;
  password?: string;
  role?: 'admin' | 'user';
} = {}): Promise<{ id: number; email: string; plainPassword: string }> {
  const email = opts.email ?? 'user@test.com';
  const password = opts.password ?? 'TestPass1!';
  const passwordHash = await bcrypt.hash(password, 4);
  const [row] = (await db('users')
    .insert({
      email,
      password_hash: passwordHash,
      first_name: 'Test',
      last_name: 'User',
      role: opts.role ?? 'user',
      is_active: true,
      must_change_password: false,
      failed_login_attempts: 0,
      employment_percentage: 100,
      daily_hours_override: null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'email'])) as Array<{ id: number; email: string }>;
  return { id: row.id, email: row.email, plainPassword: password };
}

async function seedClient(): Promise<{ id: number }> {
  const [row] = (await db('clients')
    .insert({ name: 'Test Client', is_active: true, created_at: new Date(), updated_at: new Date() })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedProject(clientId: number): Promise<{ id: number }> {
  const [row] = (await db('projects')
    .insert({ client_id: clientId, name: 'Test Project', is_active: true, created_at: new Date(), updated_at: new Date() })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedTask(projectId: number): Promise<{ id: number }> {
  const [row] = (await db('tasks')
    .insert({ project_id: projectId, name: 'Test Task', status: 'open', created_at: new Date(), updated_at: new Date() })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedAssignment(userId: number, taskId: number): Promise<void> {
  await db('user_task_assignments').insert({
    user_id: userId,
    task_id: taskId,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  return res.body.accessToken as string;
}

function yesterday(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

/** Insert an open timer row directly for the given user on the given date. */
async function seedOpenTimerRow(userId: number, date: string): Promise<{ id: number }> {
  const [row] = (await db('time_entries')
    .insert({
      user_id: userId,
      date,
      start_time: '09:00:00',
      // end_time, duration_minutes, client_id, project_id, task_id, location all null
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
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

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('Auth guard', () => {
  it('GET /timer/status returns 401 without token', async () => {
    const res = await request(app).get('/timer/status');
    expect(res.status).toBe(401);
  });

  it('POST /timer/start returns 401 without token', async () => {
    const res = await request(app).post('/timer/start');
    expect(res.status).toBe(401);
  });

  it('POST /timer/stop returns 401 without token', async () => {
    const res = await request(app).post('/timer/stop');
    expect(res.status).toBe(401);
  });
});

// ── GET /timer/status ─────────────────────────────────────────────────────────

describe('GET /timer/status', () => {
  it('returns running:false when no timer exists', async () => {
    const user = await seedUser();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get('/timer/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ running: false });
  });

  it('returns running:true with timeEntryId and elapsedSeconds when timer is active today', async () => {
    const user = await seedUser();
    const token = await login(user.email, user.plainPassword);

    const start = await request(app)
      .post('/timer/start')
      .set('Authorization', `Bearer ${token}`);
    expect(start.status).toBe(201);

    const res = await request(app)
      .get('/timer/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.running).toBe(true);
    expect(res.body.timeEntryId).toBe(start.body.timeEntryId);
    expect(typeof res.body.startTime).toBe('string');
    expect(res.body.elapsedSeconds).toBeGreaterThanOrEqual(0);
  });

  it('returns running:false when the only open row is from yesterday', async () => {
    const user = await seedUser();
    const token = await login(user.email, user.plainPassword);
    await seedOpenTimerRow(user.id, yesterday());

    const res = await request(app)
      .get('/timer/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ running: false });
  });
});

// ── POST /timer/start ─────────────────────────────────────────────────────────

describe('POST /timer/start', () => {
  it('creates a partial time_entries row and returns timeEntryId + startTime', async () => {
    const user = await seedUser();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/timer/start')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(typeof res.body.timeEntryId).toBe('number');
    expect(typeof res.body.startTime).toBe('string');

    const row = await db('time_entries').where({ id: res.body.timeEntryId }).first();
    expect(row).toBeTruthy();
    expect(row.end_time).toBeNull();
    expect(row.duration_minutes).toBeNull();
    expect(row.client_id).toBeNull();
    expect(row.user_id).toBe(user.id);
  });

  it('returns 409 if a timer is already running today', async () => {
    const user = await seedUser();
    const token = await login(user.email, user.plainPassword);

    await request(app).post('/timer/start').set('Authorization', `Bearer ${token}`);
    const res = await request(app)
      .post('/timer/start')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('succeeds (201) when an open row from yesterday exists', async () => {
    const user = await seedUser();
    const token = await login(user.email, user.plainPassword);
    await seedOpenTimerRow(user.id, yesterday());

    const res = await request(app)
      .post('/timer/start')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(typeof res.body.timeEntryId).toBe('number');
  });
});

// ── POST /timer/stop ──────────────────────────────────────────────────────────

describe('POST /timer/stop', () => {
  it('completes the open time_entries row and returns all fields', async () => {
    const user = await seedUser();
    const token = await login(user.email, user.plainPassword);
    const client = await seedClient();
    const project = await seedProject(client.id);
    const task = await seedTask(project.id);
    await seedAssignment(user.id, task.id);

    await request(app).post('/timer/start').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/timer/stop')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client.id,
        projectId: project.id,
        taskId: task.id,
        location: 'office',
        description: 'Timer test work',
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.timeEntryId).toBe('number');
    expect(typeof res.body.startTime).toBe('string');
    expect(typeof res.body.stopTime).toBe('string');
    expect(res.body.durationMinutes).toBeGreaterThanOrEqual(0);

    const row = await db('time_entries').where({ id: res.body.timeEntryId }).first();
    expect(row.end_time).not.toBeNull();
    expect(row.duration_minutes).not.toBeNull();
    expect(row.client_id).toBe(client.id);
    expect(row.project_id).toBe(project.id);
    expect(row.task_id).toBe(task.id);
    expect(row.location).toBe('office');
    expect(row.description).toBe('Timer test work');
  });

  it('returns 404 when no active timer exists', async () => {
    const client = await seedClient();
    const project = await seedProject(client.id);
    const task = await seedTask(project.id);
    const user = await seedUser();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/timer/stop')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client.id,
        projectId: project.id,
        taskId: task.id,
        location: 'office',
        description: 'No timer running',
      });

    expect(res.status).toBe(404);
  });

  it('returns 400 when required fields are missing from body', async () => {
    const user = await seedUser();
    const token = await login(user.email, user.plainPassword);

    await request(app).post('/timer/start').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/timer/stop')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: 1 }); // missing projectId, taskId, location, description

    expect(res.status).toBe(400);
  });

  it('returns 404 when the only open row is from yesterday (not treated as running)', async () => {
    const client = await seedClient();
    const project = await seedProject(client.id);
    const task = await seedTask(project.id);
    const user = await seedUser();
    const token = await login(user.email, user.plainPassword);
    await seedOpenTimerRow(user.id, yesterday());

    const res = await request(app)
      .post('/timer/stop')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client.id,
        projectId: project.id,
        taskId: task.id,
        location: 'office',
        description: 'Should not complete yesterday row',
      });

    expect(res.status).toBe(404);
  });
});
