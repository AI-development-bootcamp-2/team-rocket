/// <reference types="jest" />
import fs from 'fs/promises';
import path from 'path';
import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../../src/database/connection') as Knex;

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

async function clearUploadsDirectory(): Promise<void> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const entries = await fs.readdir(UPLOADS_DIR);
  await Promise.all(
    entries.map((entry) =>
      fs.rm(path.join(UPLOADS_DIR, entry), { recursive: true, force: true }),
    ),
  );
}

async function clearTables(): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await db.raw('TRUNCATE users, audit_logs, clients RESTART IDENTITY CASCADE');
      await clearUploadsDirectory();
      return;
    } catch (err: unknown) {
      const isDeadlock =
        err instanceof Error &&
        (err.message.includes('deadlock') || (err as { code?: string }).code === '40P01');
      if (isDeadlock && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 30 * attempt));
        continue;
      }
      throw err;
    }
  }
}

async function seedUser(seed: {
  email?: string;
  password?: string;
  role?: 'admin' | 'user';
  isActive?: boolean;
  firstName?: string;
  lastName?: string;
} = {}): Promise<{ id: number; email: string; plainPassword: string }> {
  const {
    email = 'user@test.com',
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

async function seedClient(name = 'Client'): Promise<{ id: number }> {
  const [row] = (await db('clients')
    .insert({ name, is_active: true, created_at: new Date(), updated_at: new Date() })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedProject(clientId: number): Promise<{ id: number }> {
  const [row] = (await db('projects')
    .insert({ client_id: clientId, name: 'Project', is_active: true, created_at: new Date(), updated_at: new Date() })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedTask(projectId: number): Promise<{ id: number }> {
  const [row] = (await db('tasks')
    .insert({ project_id: projectId, name: 'Task', status: 'open', created_at: new Date(), updated_at: new Date() })
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

async function seedTimeEntry(params: {
  userId: number;
  date: string;
  clientId: number;
  projectId: number;
  taskId: number;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
}): Promise<void> {
  await db('time_entries').insert({
    user_id: params.userId,
    date: params.date,
    start_time: params.startTime ?? '09:00',
    end_time: params.endTime ?? '13:30',
    duration_minutes: params.durationMinutes ?? 270,
    client_id: params.clientId,
    project_id: params.projectId,
    task_id: params.taskId,
    location: 'office',
    description: 'Seeded work entry',
    status: 'draft',
    version: 0,
    created_at: new Date(),
    updated_at: new Date(),
  });
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

async function seedMonthLock(year: number, month: number): Promise<void> {
  await db('month_locks').insert({
    year,
    month,
    is_locked: true,
    locked_by: 1,
    locked_at: new Date(),
  });
}

async function seedAbsence(params: {
  userId: number;
  type?: 'sick' | 'vacation_full' | 'vacation_half' | 'reserve';
  startDate: string;
  endDate?: string;
  isPartial?: boolean;
  status?: 'draft' | 'submitted';
  notes?: string | null;
  version?: number;
}): Promise<{ id: number; version: number }> {
  const [row] = (await db('absence_entries')
    .insert({
      user_id: params.userId,
      type: params.type ?? 'vacation_full',
      start_date: params.startDate,
      end_date: params.endDate ?? params.startDate,
      is_partial: params.isPartial ?? false,
      status: params.status ?? 'draft',
      notes: params.notes ?? null,
      version: params.version ?? 0,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'version'])) as Array<{ id: number; version: number }>;
  return row;
}

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}

async function scaffoldUserWithWork(): Promise<{
  user: { id: number; email: string; plainPassword: string };
  admin: { id: number; email: string; plainPassword: string };
  client: { id: number };
  project: { id: number };
  task: { id: number };
}> {
  const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
  const user = await seedUser({ email: 'user@test.com', role: 'user' });
  const client = await seedClient();
  const project = await seedProject(client.id);
  const task = await seedTask(project.id);
  await seedAssignment(user.id, task.id);
  return { user, admin, client, project, task };
}

beforeAll(async () => {
  await db.migrate.latest();
});

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await db.destroy();
});

describe('GET /absences', () => {
  it('scopes regular users to their own absences and lets admins filter', async () => {
    const { user, admin } = await scaffoldUserWithWork();
    const otherUser = await seedUser({ email: 'other@test.com' });

    await seedAbsence({ userId: user.id, type: 'vacation_full', startDate: '2026-05-07', endDate: '2026-05-10' });
    await seedAbsence({ userId: otherUser.id, type: 'reserve', startDate: '2026-05-12' });

    const userToken = await login(user.email, user.plainPassword);
    const userRes = await request(app)
      .get('/absences')
      .set('Authorization', `Bearer ${userToken}`);

    expect(userRes.status).toBe(200);
    expect(userRes.body).toHaveLength(1);
    expect(userRes.body[0].user_id).toBe(user.id);

    const adminToken = await login(admin.email, admin.plainPassword);
    const adminRes = await request(app)
      .get('/absences?user_id=' + otherUser.id + '&month=2026-05&type=reserve&date_from=2026-05-01&date_to=2026-05-31')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body).toHaveLength(1);
    expect(adminRes.body[0].user_id).toBe(otherUser.id);
    expect(adminRes.body[0].type).toBe('reserve');
  });
});

describe('POST /absences', () => {
  it('creates a sick absence, excludes Fri/Sat from impact, and returns a document warning', async () => {
    const { user } = await scaffoldUserWithWork();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/absences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'sick',
        start_date: '2026-05-07',
        end_date: '2026-05-10',
        is_partial: false,
        notes: 'Medical leave',
      });

    expect(res.status).toBe(201);
    expect(res.body.warning).toBe('חובה לצרף מסמך עד להגשה');
    expect(res.body.data.working_days_count).toBe(2);
    expect(res.body.data.quota_hours_impact).toBe(18);
  });

  it('allows future absences', async () => {
    const { user } = await scaffoldUserWithWork();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/absences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'vacation_full',
        start_date: '2099-01-11',
        end_date: '2099-01-12',
        is_partial: false,
      });

    expect(res.status).toBe(201);
  });

  it('blocks partial absences when the remaining 4.5 work hours are not covered', async () => {
    const { user, client, project, task } = await scaffoldUserWithWork();
    await seedTimeEntry({
      userId: user.id,
      date: '2026-05-11',
      clientId: client.id,
      projectId: project.id,
      taskId: task.id,
      startTime: '09:00',
      endTime: '13:00',
      durationMinutes: 240,
    });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/absences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'vacation_full',
        start_date: '2026-05-11',
        end_date: '2026-05-11',
        is_partial: true,
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Partial absence requires at least 4\.5 work hours/i);
    expect(res.body.missing_minutes).toBe(30);
  });

  it('423: cannot create absence when the month is locked', async () => {
    const { user, admin } = await scaffoldUserWithWork();
    await seedMonthLock(2026, 5);
    const token = await login(user.email, user.plainPassword);
    void admin;

    const res = await request(app)
      .post('/absences')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'vacation_full', start_date: '2026-05-10', end_date: '2026-05-10', is_partial: false });

    expect(res.status).toBe(423);
  });
});

describe('PUT /absences/:id', () => {
  it('returns 409 on optimistic-lock version mismatch', async () => {
    const { user } = await scaffoldUserWithWork();
    const absence = await seedAbsence({ userId: user.id, startDate: '2026-05-12' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .put(`/absences/${absence.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: absence.version + 1,
        notes: 'Updated notes',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
  });

  it('blocks updates when an overlapping week has already been submitted', async () => {
    const { user } = await scaffoldUserWithWork();
    const absence = await seedAbsence({ userId: user.id, startDate: '2026-05-06' });
    await seedWeeklySubmission(user.id, '2026-05-04', 'submitted');
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .put(`/absences/${absence.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: absence.version,
        notes: 'Blocked update',
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Week has already been submitted/i);
  });

  it('423: cannot update absence when the month is locked', async () => {
    const { user, admin } = await scaffoldUserWithWork();
    const absence = await seedAbsence({ userId: user.id, startDate: '2026-05-12' });
    await seedMonthLock(2026, 5);
    const token = await login(user.email, user.plainPassword);
    void admin;

    const res = await request(app)
      .put(`/absences/${absence.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ version: absence.version, notes: 'Blocked update' });

    expect(res.status).toBe(423);
  });
});

describe('DELETE /absences/:id', () => {
  it('soft-deletes the absence and removes it from list responses', async () => {
    const { user } = await scaffoldUserWithWork();
    const absence = await seedAbsence({ userId: user.id, startDate: '2026-05-15' });
    const token = await login(user.email, user.plainPassword);

    const delRes = await request(app)
      .delete(`/absences/${absence.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(204);

    const row = await db('absence_entries').where('id', absence.id).first();
    expect(row.deleted_at).not.toBeNull();

    const listRes = await request(app)
      .get('/absences')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(0);
  });

  it('423: cannot delete absence when the month is locked', async () => {
    const { user, admin } = await scaffoldUserWithWork();
    const absence = await seedAbsence({ userId: user.id, startDate: '2026-05-15' });
    await seedMonthLock(2026, 5);
    const token = await login(user.email, user.plainPassword);
    void admin;

    const res = await request(app)
      .delete(`/absences/${absence.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(423);
  });
});

describe('POST /absences/:id/documents', () => {
  it('accepts a PDF upload and allows upload even after the month is locked', async () => {
    const { user, admin } = await scaffoldUserWithWork();
    const absence = await seedAbsence({ userId: user.id, type: 'sick', startDate: '2026-05-20' });
    await seedMonthLock(2026, 5);
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post(`/absences/${absence.id}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4\nabsence document'), 'medical.pdf');

    expect(res.status).toBe(201);
    expect(res.body.file_name).toBe('medical.pdf');
    expect(res.body.mime_type).toBe('application/pdf');

    const audit = await db('audit_logs')
      .where({ target_entity_type: 'ABSENCE', target_entity_id: absence.id, action: 'UPDATE' })
      .orderBy('id', 'desc')
      .first();

    expect(audit.new_value.document_action).toBe('upload');

    const adminToken = await login(admin.email, admin.plainPassword);
    const deleteRes = await request(app)
      .delete(`/absences/${absence.id}/documents/${res.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(204);
  });

  it('rejects unsupported file types by server-side MIME detection', async () => {
    const { user } = await scaffoldUserWithWork();
    const absence = await seedAbsence({ userId: user.id, startDate: '2026-05-20' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post(`/absences/${absence.id}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('MZ-not-a-supported-doc'), 'malware.exe');

    expect(res.status).toBe(415);
    expect(res.body.error).toMatch(/Unsupported file type/i);
  });

  it('rejects files larger than 10 MB', async () => {
    const { user } = await scaffoldUserWithWork();
    const absence = await seedAbsence({ userId: user.id, startDate: '2026-05-20' });
    const token = await login(user.email, user.plainPassword);
    const oversizedPdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(10 * 1024 * 1024 + 1, 0),
    ]);

    const res = await request(app)
      .post(`/absences/${absence.id}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', oversizedPdf, 'too-large.pdf');

    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/File too large/i);
  });
});
