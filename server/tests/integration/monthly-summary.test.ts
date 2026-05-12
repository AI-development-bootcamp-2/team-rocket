/// <reference types="jest" />
/**
 * Integration tests for GET /monthly-summary.
 * Requires a running Postgres instance at DATABASE_URL (set in tests/setup.ts).
 * Isolation: beforeEach truncates users + audit_logs + clients CASCADE.
 */
import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../../src/database/connection') as Knex;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clearTables(): Promise<void> {
  await db.raw('TRUNCATE users, audit_logs, clients RESTART IDENTITY CASCADE');
}

interface UserSeed {
  email?: string;
  password?: string;
  role?: 'admin' | 'user';
  employmentPercentage?: number;
  dailyHoursOverride?: number | null;
}

async function seedUser(
  seed: UserSeed = {},
): Promise<{ id: number; email: string; plainPassword: string }> {
  const {
    email = 'user@test.com',
    password = 'TestPass1!',
    role = 'user',
    employmentPercentage = 100,
    dailyHoursOverride = null,
  } = seed;

  const passwordHash = await bcrypt.hash(password, 4);
  const [row] = (await db('users')
    .insert({
      email,
      password_hash: passwordHash,
      first_name: 'Test',
      last_name: 'User',
      role,
      is_active: true,
      must_change_password: false,
      failed_login_attempts: 0,
      employment_percentage: employmentPercentage,
      daily_hours_override: dailyHoursOverride,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'email'])) as Array<{ id: number; email: string }>;

  return { id: row.id, email: row.email, plainPassword: password };
}

async function seedClient(name = 'Test Client'): Promise<{ id: number }> {
  const [row] = (await db('clients')
    .insert({ name, is_active: true, created_at: new Date(), updated_at: new Date() })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedProject(clientId: number, name = 'Test Project'): Promise<{ id: number }> {
  const [row] = (await db('projects')
    .insert({
      client_id: clientId,
      name,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedTask(projectId: number): Promise<{ id: number }> {
  const [row] = (await db('tasks')
    .insert({
      project_id: projectId,
      name: 'Test Task',
      status: 'open',
      created_at: new Date(),
      updated_at: new Date(),
    })
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

interface TimeEntrySeed {
  userId: number;
  date: string;
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
  clientId: number;
  projectId: number;
  taskId: number;
  deletedAt?: Date | null;
}

async function seedTimeEntry(seed: TimeEntrySeed): Promise<{ id: number }> {
  const [row] = (await db('time_entries')
    .insert({
      user_id: seed.userId,
      date: seed.date,
      start_time: seed.startTime ?? '09:00',
      end_time: seed.endTime ?? '18:00',
      duration_minutes: seed.durationMinutes ?? 540,
      client_id: seed.clientId,
      project_id: seed.projectId,
      task_id: seed.taskId,
      location: 'office',
      status: 'draft',
      version: 1,
      deleted_at: seed.deletedAt ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedHoliday(date: string, type: 'national' | 'company' = 'national'): Promise<void> {
  await db('holiday_calendar').insert({
    date,
    name: 'Test Holiday',
    type,
    created_at: new Date(),
  });
}

interface AbsenceSeed {
  userId: number;
  startDate: string;
  endDate?: string;
  isPartial?: boolean;
  type?: 'sick' | 'vacation_full' | 'vacation_half' | 'reserve';
}

async function seedAbsence(seed: AbsenceSeed): Promise<{ id: number }> {
  const [row] = (await db('absence_entries')
    .insert({
      user_id: seed.userId,
      type: seed.type ?? (seed.isPartial ? 'vacation_half' : 'sick'),
      start_date: seed.startDate,
      end_date: seed.endDate ?? seed.startDate,
      is_partial: seed.isPartial ?? false,
      status: 'approved',
      version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  return res.body.accessToken as string;
}

// ── Scaffold ──────────────────────────────────────────────────────────────────

interface Scaffold {
  user: { id: number; email: string; plainPassword: string };
  client: { id: number };
  project: { id: number };
  task: { id: number };
  token: string;
}

async function scaffold(userSeed: UserSeed = {}): Promise<Scaffold> {
  const user = await seedUser(userSeed);
  const client = await seedClient();
  const project = await seedProject(client.id);
  const task = await seedTask(project.id);
  await seedAssignment(user.id, task.id);
  const token = await login(user.email, user.plainPassword);
  return { user, client, project, task, token };
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

// January 2026: Jan 1 = Thursday → 21 working days (Sun–Thu) → quotaHours = 189h

describe('GET /monthly-summary — quota, reported hours & completion', () => {
  it('returns correct quotaHours for a standard month with no holidays or absences', async () => {
    const { token } = await scaffold();

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.quotaHours).toBe(189); // 21 working days × 9h
  });

  it('deducts 1 national holiday and 1 full-day absence from quotaHours', async () => {
    const { user, token } = await scaffold();

    // Jan 4 (Sunday) = holiday → workingDays drops from 21 to 20
    await seedHoliday('2026-01-04', 'national');
    // Jan 5 (Monday) = full-day absence → deduct 1 × dailyStandard
    await seedAbsence({ userId: user.id, startDate: '2026-01-05', isPartial: false });

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // (21 − 1 holiday) × 9 − 1 full-day × 9 = 20 × 9 − 9 = 171
    expect(res.body.quotaHours).toBe(171);
  });

  it('scales quotaHours with employment_percentage (50%)', async () => {
    const { token } = await scaffold({ employmentPercentage: 50 });

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // dailyStandard = 9 × 0.5 = 4.5  →  21 × 4.5 = 94.5
    expect(res.body.quotaHours).toBe(94.5);
  });

  it('reportedHours equals sum of non-deleted time entries in the month', async () => {
    const { user, client, project, task, token } = await scaffold();

    // Non-deleted: 9h
    await seedTimeEntry({ userId: user.id, date: '2026-01-04', durationMinutes: 540, clientId: client.id, projectId: project.id, taskId: task.id });
    // Soft-deleted: must NOT count
    await seedTimeEntry({ userId: user.id, date: '2026-01-05', durationMinutes: 540, clientId: client.id, projectId: project.id, taskId: task.id, deletedAt: new Date() });

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reportedHours).toBe(9); // 540 min / 60
  });

  it('completionPercentage = floor(reportedHours / quotaHours × 100)', async () => {
    const { user, client, project, task, token } = await scaffold();

    // Seed 2 entries × 9h = 18h total
    await seedTimeEntry({ userId: user.id, date: '2026-01-04', durationMinutes: 540, clientId: client.id, projectId: project.id, taskId: task.id });
    await seedTimeEntry({ userId: user.id, date: '2026-01-05', durationMinutes: 540, clientId: client.id, projectId: project.id, taskId: task.id });

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // floor(18 / 189 × 100) = floor(9.523…) = 9
    expect(res.body.quotaHours).toBe(189);
    expect(res.body.reportedHours).toBe(18);
    expect(res.body.completionPercentage).toBe(9);
  });

  it('response includes year and month fields', async () => {
    const { token } = await scaffold();

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.year).toBe(2026);
    expect(res.body.month).toBe(1);
  });
});

// T014/T015 pin today to 2026-01-15: 11 elapsed working days (Sun–Thu) → expected = 99h.
// Only `Date` is faked; async/timer primitives are left real so db calls work.

describe('GET /monthly-summary — missingHoursToDate', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('equals gap between expected-by-today and reported hours (mid-month gap)', async () => {
    jest.useFakeTimers({
      now: new Date('2026-01-15T12:00:00.000Z'),
      doNotFake: [
        'hrtime', 'nextTick', 'performance', 'queueMicrotask',
        'setImmediate', 'clearImmediate',
        'setInterval', 'clearInterval',
        'setTimeout', 'clearTimeout',
      ],
    });

    const { user, client, project, task, token } = await scaffold();

    // 6 × 9h = 54h reported; expected = 99h → gap = 45h
    for (const date of ['2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-11']) {
      await seedTimeEntry({ userId: user.id, date, durationMinutes: 540, clientId: client.id, projectId: project.id, taskId: task.id });
    }

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reportedHours).toBe(54);
    // 11 elapsed working days × 9h = 99h expected; 54h reported → 99 − 54 = 45h
    expect(res.body.missingHoursToDate).toBe(45);
  });

  it('returns 0 when user over-reports (extra hours carry over, result is clamped to 0)', async () => {
    jest.useFakeTimers({
      now: new Date('2026-01-15T12:00:00.000Z'),
      doNotFake: [
        'hrtime', 'nextTick', 'performance', 'queueMicrotask',
        'setImmediate', 'clearImmediate',
        'setInterval', 'clearInterval',
        'setTimeout', 'clearTimeout',
      ],
    });

    const { user, client, project, task, token } = await scaffold();

    // 11 × 10h = 110h — user logged 1h extra each day (standard is 9h)
    // expected = 11 × 9h = 99h; reported = 110h → max(0, 99 − 110) = 0
    for (const date of [
      '2026-01-01', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
      '2026-01-11', '2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15',
    ]) {
      await seedTimeEntry({ userId: user.id, date, durationMinutes: 600, clientId: client.id, projectId: project.id, taskId: task.id });
    }

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reportedHours).toBe(110);
    expect(res.body.missingHoursToDate).toBe(0); // never negative even when over-reported
  });

  it('returns 0 for a future month (no elapsed working days)', async () => {
    const { token } = await scaffold();

    // 2027-01 is entirely in the future from today (2026-05-12); no entries needed
    const res = await request(app)
      .get('/monthly-summary?year=2027&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.missingHoursToDate).toBe(0);
  });

  it('for a past month equals max(0, quotaHours − reportedHours)', async () => {
    const { user, client, project, task, token } = await scaffold();

    // January 2026 is past; cutoff = Jan 31; quotaHours = 189h (21 × 9h)
    // Seed 10 × 9h = 90h → gap = 189 − 90 = 99h
    for (const date of [
      '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
      '2026-01-11', '2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15',
    ]) {
      await seedTimeEntry({ userId: user.id, date, durationMinutes: 540, clientId: client.id, projectId: project.id, taskId: task.id });
    }

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reportedHours).toBe(90);
    expect(res.body.quotaHours).toBe(189);
    expect(res.body.missingHoursToDate).toBe(99); // 189 − 90
  });
});

// Jan 2026 working days (Sun–Thu): 1,4,5,6,7,8,11,12,13,14,15,18,19,20,21,22,25,26,27,28,29 = 21 days

describe('GET /monthly-summary — daysWithoutReport (T020–T023)', () => {
  it('T020 — days with time entries are NOT counted in daysWithoutReport', async () => {
    const { user, client, project, task, token } = await scaffold();

    // Entries on Jan 4 and Jan 5 only; 19 remaining working days have nothing
    await seedTimeEntry({ userId: user.id, date: '2026-01-04', durationMinutes: 540, clientId: client.id, projectId: project.id, taskId: task.id });
    await seedTimeEntry({ userId: user.id, date: '2026-01-05', durationMinutes: 540, clientId: client.id, projectId: project.id, taskId: task.id });

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // 21 working days − 2 with entries = 19 without report
    expect(res.body.daysWithoutReport).toBe(19);
  });

  it('T021 — days covered by a full-day absence are NOT counted in daysWithoutReport', async () => {
    const { user, token } = await scaffold();

    // Full-day absence on Jan 4 (Sunday, a working day) — no entries anywhere
    await seedAbsence({ userId: user.id, startDate: '2026-01-04', isPartial: false });

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // 21 working days − 1 full-day absence = 20 without report
    expect(res.body.daysWithoutReport).toBe(20);
  });

  it('T022 — partial absence with no work hours DOES count toward daysWithoutReport', async () => {
    const { user, token } = await scaffold();

    // Partial absence on Jan 4, no entries anywhere — Jan 4 still counts as without report
    await seedAbsence({ userId: user.id, startDate: '2026-01-04', isPartial: true });

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // All 21 working days count — partial absence on Jan 4 does NOT exclude it
    expect(res.body.daysWithoutReport).toBe(21);
  });

  it('T023 — weekends (Fri/Sat) and holidays are never included in daysWithoutReport', async () => {
    const { token } = await scaffold();

    // Holiday on Jan 4 (Sunday → a working day) → removes it from working-day pool
    await seedHoliday('2026-01-04', 'national');

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Without any entries: all 20 remaining working days (21 − 1 holiday) are "without report"
    // Jan 2 (Fri) and Jan 3 (Sat) are weekends and must never appear in this count
    expect(res.body.daysWithoutReport).toBe(20);
  });
});

describe('GET /monthly-summary — absenceHours (T024–T025)', () => {
  it('T024 — absenceHours = 9 for 1 full-day absence and 4.5 for 1 partial (total 13.5)', async () => {
    const { user, token } = await scaffold();

    // Full-day absence on Jan 4 (dailyStandard = 9h → +9)
    await seedAbsence({ userId: user.id, startDate: '2026-01-04', isPartial: false });
    // Partial absence on Jan 5 → +4.5
    await seedAbsence({ userId: user.id, startDate: '2026-01-05', isPartial: true });

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.absenceHours).toBe(13.5);
  });

  it('T025 — national holiday does NOT contribute to absenceHours; only user absences do', async () => {
    const { user, token } = await scaffold();

    // Full-day user absence on Jan 4 → +9h to absenceHours
    await seedAbsence({ userId: user.id, startDate: '2026-01-04', isPartial: false });
    // National holiday on Jan 5 — must NOT add hours to absenceHours
    await seedHoliday('2026-01-05', 'national');

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Only the user absence counts; holiday must not be added
    expect(res.body.absenceHours).toBe(9);
  });
});

describe('GET /monthly-summary — projectBreakdown (T029–T031)', () => {
  it('T029 — projectBreakdown is sorted by hours descending', async () => {
    const { user, client, project: projectA, task: taskA, token } = await scaffold();

    // Second project: 36h (4 × 9h)
    const projectB = await seedProject(client.id, 'Project B');
    const taskB = await seedTask(projectB.id);
    await seedAssignment(user.id, taskB.id);

    // Third project: 8h (1 entry of 480 min)
    const projectC = await seedProject(client.id, 'Project C');
    const taskC = await seedTask(projectC.id);
    await seedAssignment(user.id, taskC.id);

    // projectA: 6 × 9h = 54h
    for (const date of ['2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-11']) {
      await seedTimeEntry({ userId: user.id, date, durationMinutes: 540, clientId: client.id, projectId: projectA.id, taskId: taskA.id });
    }
    // projectB: 4 × 9h = 36h
    for (const date of ['2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15']) {
      await seedTimeEntry({ userId: user.id, date, durationMinutes: 540, clientId: client.id, projectId: projectB.id, taskId: taskB.id });
    }
    // projectC: 1 × 8h = 8h
    await seedTimeEntry({ userId: user.id, date: '2026-01-18', durationMinutes: 480, clientId: client.id, projectId: projectC.id, taskId: taskC.id });

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const breakdown = res.body.projectBreakdown as Array<{ hours: number }>;
    expect(breakdown).toHaveLength(3);
    expect(breakdown[0].hours).toBe(54);
    expect(breakdown[1].hours).toBe(36);
    expect(breakdown[2].hours).toBe(8);
  });

  it('T030 — projectBreakdown excludes projects with 0 hours this month', async () => {
    const { user, client, project: projectA, task: taskA, token } = await scaffold();

    // projectB has no entries this month — must be absent from breakdown
    const projectB = await seedProject(client.id, 'Project B');
    const taskB = await seedTask(projectB.id);
    await seedAssignment(user.id, taskB.id);

    await seedTimeEntry({ userId: user.id, date: '2026-01-04', durationMinutes: 540, clientId: client.id, projectId: projectA.id, taskId: taskA.id });

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const breakdown = res.body.projectBreakdown as Array<{ projectId: number }>;
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0].projectId).toBe(projectA.id);
  });

  it('T031 — projectBreakdown items include projectId, projectName, and hours rounded to 2 decimal places', async () => {
    const { user, client, project, task, token } = await scaffold();

    // 100 minutes = 100/60 = 1.6666…h → should be rounded to 1.67
    await seedTimeEntry({ userId: user.id, date: '2026-01-04', durationMinutes: 100, clientId: client.id, projectId: project.id, taskId: task.id });

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const [item] = res.body.projectBreakdown as Array<{ projectId: number; projectName: string; hours: number }>;
    expect(item.projectId).toBe(project.id);
    expect(item.projectName).toBe('Test Project');
    expect(item.hours).toBe(1.67);
  });
});

describe('GET /monthly-summary — edge cases (Phase 9)', () => {
  it('T052 — employment_percentage = 0 → quotaHours = 0, missingHoursToDate = 0, completionPercentage = 0', async () => {
    const { token } = await scaffold({ employmentPercentage: 0 });

    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.quotaHours).toBe(0);
    expect(res.body.missingHoursToDate).toBe(0);
    expect(res.body.completionPercentage).toBe(0);
  });

  it('T054 — cross-midnight entry (22:00–02:00) splits 2h into January and 2h into February', async () => {
    const { user, client, project, task, token } = await scaffold();

    // Jan 31, 22:00–02:00 → 120 min belong to Jan, 120 min overflow into Feb
    await seedTimeEntry({
      userId: user.id,
      date: '2026-01-31',
      startTime: '22:00',
      endTime: '02:00',
      durationMinutes: 240,
      clientId: client.id,
      projectId: project.id,
      taskId: task.id,
    });

    const [janRes, febRes] = await Promise.all([
      request(app).get('/monthly-summary?year=2026&month=1').set('Authorization', `Bearer ${token}`),
      request(app).get('/monthly-summary?year=2026&month=2').set('Authorization', `Bearer ${token}`),
    ]);

    expect(janRes.status).toBe(200);
    expect(janRes.body.reportedHours).toBe(2); // 22:00–00:00 = 120 min

    expect(febRes.status).toBe(200);
    expect(febRes.body.reportedHours).toBe(2); // 00:00–02:00 = 120 min overflow
  });

  it('T053 — future month returns 200 with reportedHours = 0 and missingHoursToDate = 0, no crash', async () => {
    const { token } = await scaffold();

    // 2027-06 is entirely in the future from today (2026-05-12)
    const res = await request(app)
      .get('/monthly-summary?year=2027&month=6')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reportedHours).toBe(0);
    expect(res.body.missingHoursToDate).toBe(0);
  });
});

describe('GET /monthly-summary — permissions (T044–T046)', () => {
  it('T044 — regular user requesting another user\'s summary receives 403', async () => {
    const { token } = await scaffold({ email: 'regular@test.com', role: 'user' });
    const other = await seedUser({ email: 'other@test.com', role: 'user' });

    const res = await request(app)
      .get(`/monthly-summary?year=2026&month=1&userId=${other.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('T045 — admin can request any user\'s summary and receives 200', async () => {
    const { token: adminToken } = await scaffold({ email: 'admin@test.com', role: 'admin' });
    const other = await seedUser({ email: 'other@test.com', role: 'user' });

    const res = await request(app)
      .get(`/monthly-summary?year=2026&month=1&userId=${other.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('T046 — unauthenticated request (no JWT) receives 401', async () => {
    const res = await request(app)
      .get('/monthly-summary?year=2026&month=1');

    expect(res.status).toBe(401);
  });
});
