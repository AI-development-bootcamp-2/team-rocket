/// <reference types="jest" />
import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../../src/database/connection') as Knex;

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

async function seedWeeklySubmission(
  userId: number,
  weekStartDate: string,
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'missing',
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

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateOnly(value: Date): string {
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function shiftDate(dateStr: string, days: number): string {
  const date = parseDateOnly(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

function getWeekStartDate(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  const dayOfWeek = date.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setUTCDate(date.getUTCDate() + daysToMonday);
  return formatDateOnly(date);
}

function getIsraelToday(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
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

describe('GET /admin/dashboard', () => {
  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app).get('/admin/dashboard?year=2026&month=5');
    expect(res.status).toBe(401);
  });

  it('403: non-admin user is rejected', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get('/admin/dashboard?year=2026&month=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient permissions');
  });

  it('200: returns monthly matrix with live missing/not_started statuses and summary counts', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin', firstName: 'Admin' });
    const alice = await seedUser({ email: 'alice@test.com', firstName: 'Alice', lastName: 'Cohen' });
    const bob = await seedUser({ email: 'bob@test.com', firstName: 'Bob', lastName: 'Levi' });
    const inactive = await seedUser({ email: 'inactive@test.com', isActive: false, firstName: 'Inactive' });
    void inactive;

    const today = getIsraelToday();
    const currentWeekStart = getWeekStartDate(today);
    const pastWeekStart = shiftDate(currentWeekStart, -7);
    const futureWeekStart = shiftDate(currentWeekStart, 7);

    await seedWeeklySubmission(alice.id, currentWeekStart, 'submitted');
    await seedWeeklySubmission(bob.id, currentWeekStart, 'approved');
    await seedWeeklySubmission(alice.id, pastWeekStart, 'draft');
    await seedWeeklySubmission(bob.id, pastWeekStart, 'rejected');

    const [yearStr, monthStr] = currentWeekStart.split('-');
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get(`/admin/dashboard?year=${Number(yearStr)}&month=${Number(monthStr)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.year).toBe(Number(yearStr));
    expect(res.body.month).toBe(Number(monthStr));
    expect(Array.isArray(res.body.weeks)).toBe(true);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.summary).toMatchObject({
      total_users: 2,
      submitted_this_week: 1,
      missing: 0,
      approved: 1,
      summary_week_start_date: currentWeekStart,
    });

    const aliceRow = res.body.rows.find((row: { first_name: string }) => row.first_name === 'Alice');
    const bobRow = res.body.rows.find((row: { first_name: string }) => row.first_name === 'Bob');
    expect(aliceRow).toBeTruthy();
    expect(bobRow).toBeTruthy();

    expect(aliceRow.cells.find((cell: { week_start_date: string }) => cell.week_start_date === currentWeekStart)).toMatchObject({
      week_start_date: currentWeekStart,
      status: 'submitted',
    });
    expect(bobRow.cells.find((cell: { week_start_date: string }) => cell.week_start_date === currentWeekStart)).toMatchObject({
      week_start_date: currentWeekStart,
      status: 'approved',
    });
    expect(aliceRow.cells.find((cell: { week_start_date: string }) => cell.week_start_date === pastWeekStart)).toMatchObject({
      week_start_date: pastWeekStart,
      status: 'missing',
    });
    expect(bobRow.cells.find((cell: { week_start_date: string }) => cell.week_start_date === pastWeekStart)).toMatchObject({
      week_start_date: pastWeekStart,
      status: 'rejected',
    });

    const futureResponse = await request(app)
      .get(`/admin/dashboard?year=${Number(futureWeekStart.slice(0, 4))}&month=${Number(futureWeekStart.slice(5, 7))}`)
      .set('Authorization', `Bearer ${token}`);

    expect(futureResponse.status).toBe(200);
    const futureAliceRow = futureResponse.body.rows.find((row: { first_name: string }) => row.first_name === 'Alice');
    expect(futureAliceRow.cells.find((cell: { week_start_date: string }) => cell.week_start_date === futureWeekStart)).toMatchObject({
      week_start_date: futureWeekStart,
      status: 'not_started',
    });
  });
});
