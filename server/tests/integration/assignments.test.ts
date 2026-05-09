/**
 * Integration tests — Assignments module (F08)
 *
 * Requires a running Postgres instance at DATABASE_URL (set in tests/setup.ts).
 *
 * Isolation: beforeEach truncates users + audit_logs + clients CASCADE.
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
  await db.raw('TRUNCATE users, audit_logs, clients RESTART IDENTITY CASCADE');
}

interface UserSeed {
  email?: string;
  password?: string;
  role?: 'admin' | 'user';
  isActive?: boolean;
  firstName?: string;
  lastName?: string;
}

async function seedUser(seed: UserSeed = {}): Promise<{ id: number; email: string; plainPassword: string }> {
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

async function seedClient(name = 'Test Client', isActive = true): Promise<{ id: number; name: string }> {
  const [row] = (await db('clients')
    .insert({
      name,
      is_active: isActive,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'name'])) as Array<{ id: number; name: string }>;

  return row;
}

async function seedProject(seed: {
  name?: string;
  clientId?: number;
  isActive?: boolean;
} = {}): Promise<{ id: number; name: string }> {
  const clientId = seed.clientId ?? (await seedClient()).id;
  const [row] = (await db('projects')
    .insert({
      client_id: clientId,
      name: seed.name ?? 'Test Project',
      is_active: seed.isActive ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'name'])) as Array<{ id: number; name: string }>;

  return row;
}

async function seedTask(seed: {
  projectId: number;
  name?: string;
  status?: 'open' | 'closed';
}): Promise<{ id: number; name: string }> {
  const [row] = (await db('tasks')
    .insert({
      project_id: seed.projectId,
      name: seed.name ?? 'Test Task',
      status: seed.status ?? 'open',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'name'])) as Array<{ id: number; name: string }>;

  return row;
}

async function seedPermissionFlag(userId: number, scopedProjectIds: number[]): Promise<void> {
  await db('permission_flags').insert({
    user_id: userId,
    flag_name: 'canAssignProjectTasks',
    scoped_project_ids: JSON.stringify(scopedProjectIds),
    created_at: new Date(),
  });
}

async function seedAssignment(userId: number, taskId: number, isActive = true): Promise<{ id: number }> {
  const [row] = (await db('user_task_assignments')
    .insert({
      user_id: userId,
      task_id: taskId,
      is_active: isActive,
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

// ── GET /assignments ──────────────────────────────────────────────────────────

describe('GET /assignments', () => {
  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app).get('/assignments');
    expect(res.status).toBe(401);
  });

  it('200: admin sees all assignments across all projects', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user1 = await seedUser({ email: 'user1@test.com', role: 'user' });
    const user2 = await seedUser({ email: 'user2@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task1 = await seedTask({ projectId: project.id, name: 'Task A' });
    const task2 = await seedTask({ projectId: project.id, name: 'Task B' });
    await seedAssignment(user1.id, task1.id);
    await seedAssignment(user2.id, task2.id);

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/assignments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('200: regular user sees only own assignments', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user1 = await seedUser({ email: 'user1@test.com', role: 'user' });
    const user2 = await seedUser({ email: 'user2@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task1 = await seedTask({ projectId: project.id, name: 'Task A' });
    const task2 = await seedTask({ projectId: project.id, name: 'Task B' });
    await seedAssignment(user1.id, task1.id);
    await seedAssignment(user2.id, task2.id);

    const token = await login(user1.email, user1.plainPassword);
    const res = await request(app)
      .get('/assignments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe(user1.id);

    void admin; // referenced only to satisfy linter
  });

  it('200: user+flag sees only assignments within their scoped projects', async () => {
    const flagUser = await seedUser({ email: 'flag@test.com', role: 'user' });
    const other = await seedUser({ email: 'other@test.com', role: 'user' });
    const client = await seedClient();
    const projectA = await seedProject({ clientId: client.id, name: 'Project A' });
    const projectB = await seedProject({ clientId: client.id, name: 'Project B' });
    const taskA = await seedTask({ projectId: projectA.id, name: 'Task A' });
    const taskB = await seedTask({ projectId: projectB.id, name: 'Task B' });
    await seedPermissionFlag(flagUser.id, [projectA.id]);
    await seedAssignment(other.id, taskA.id); // within scoped project
    await seedAssignment(other.id, taskB.id); // outside scoped project

    const token = await login(flagUser.email, flagUser.plainPassword);
    const res = await request(app)
      .get('/assignments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Only the assignment in the scoped project is visible
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].projectId).toBe(projectA.id);
  });

  it('200: admin can filter by project_id', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const projectA = await seedProject({ clientId: client.id, name: 'Project A' });
    const projectB = await seedProject({ clientId: client.id, name: 'Project B' });
    const taskA = await seedTask({ projectId: projectA.id });
    const taskB = await seedTask({ projectId: projectB.id });
    await seedAssignment(user.id, taskA.id);
    await seedAssignment(user.id, taskB.id);

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get(`/assignments?project_id=${projectA.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].projectId).toBe(projectA.id);
  });
});

// ── GET /assignments/:id ──────────────────────────────────────────────────────

describe('GET /assignments/:id', () => {
  it('200: returns full assignment details with joined fields', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user', firstName: 'Alice', lastName: 'Doe' });
    const client = await seedClient('Acme Corp');
    const project = await seedProject({ clientId: client.id, name: 'Alpha' });
    const task = await seedTask({ projectId: project.id, name: 'Build UI' });
    const { id } = await seedAssignment(user.id, task.id);

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.user.firstName).toBe('Alice');
    expect(res.body.data.task.name).toBe('Build UI');
    expect(res.body.data.projectName).toBe('Alpha');
    expect(res.body.data.clientName).toBe('Acme Corp');
  });

  it('404: returns 404 for non-existent assignment', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/assignments/99999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── POST /assignments ─────────────────────────────────────────────────────────

describe('POST /assignments', () => {
  it('201: admin can create an assignment', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id, task_id: task.id });

    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBe(user.id);
    expect(res.body.data.taskId).toBe(task.id);
    expect(res.body.data.isActive).toBe(true);
  });

  it('403: regular user (no flag) cannot create assignments', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const regularUser = await seedUser({ email: 'regular@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });

    const token = await login(regularUser.email, regularUser.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: admin.id, task_id: task.id });

    expect(res.status).toBe(403);
  });

  it('409: admin cannot create duplicate active assignment for same user+task', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    await seedAssignment(user.id, task.id); // already active

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id, task_id: task.id });

    expect(res.status).toBe(409);
  });

  it('201: creating an assignment for an inactive row reactivates it', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const { id: existingId } = await seedAssignment(user.id, task.id, false); // inactive

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id, task_id: task.id });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(existingId); // same row reactivated
    expect(res.body.data.isActive).toBe(true);
  });

  it('422: admin cannot assign a closed task', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id, status: 'closed' });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id, task_id: task.id });

    expect(res.status).toBe(422);
  });

  it('403: user+flag cannot assign task outside their scoped projects', async () => {
    const flagUser = await seedUser({ email: 'flag@test.com', role: 'user' });
    const targetUser = await seedUser({ email: 'target@test.com', role: 'user' });
    const client = await seedClient();
    const allowedProject = await seedProject({ clientId: client.id, name: 'Allowed' });
    const forbiddenProject = await seedProject({ clientId: client.id, name: 'Forbidden' });
    const taskInForbiddenProject = await seedTask({ projectId: forbiddenProject.id });
    await seedPermissionFlag(flagUser.id, [allowedProject.id]); // flag only for allowedProject

    const token = await login(flagUser.email, flagUser.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: targetUser.id, task_id: taskInForbiddenProject.id });

    expect(res.status).toBe(403);
  });

  it('201: user+flag can assign within their scoped project', async () => {
    const flagUser = await seedUser({ email: 'flag@test.com', role: 'user' });
    const targetUser = await seedUser({ email: 'target@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    await seedPermissionFlag(flagUser.id, [project.id]);

    const token = await login(flagUser.email, flagUser.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: targetUser.id, task_id: task.id });

    expect(res.status).toBe(201);
    expect(res.body.data.isActive).toBe(true);
  });
});

// ── PUT /assignments/:id ──────────────────────────────────────────────────────

describe('PUT /assignments/:id', () => {
  it('200: admin can toggle assignment is_active', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const { id } = await seedAssignment(user.id, task.id, true);

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .put(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('400: missing is_active field returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const { id } = await seedAssignment(user.id, task.id);

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .put(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('403: regular user (no flag) cannot toggle an assignment', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const { id } = await seedAssignment(user.id, task.id);

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .put(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(403);
    void admin;
  });

  it('404: toggle returns 404 for non-existent assignment', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put('/assignments/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(404);
  });

  it('403: user+flag cannot toggle assignment outside their scoped projects', async () => {
    const flagUser = await seedUser({ email: 'flag@test.com', role: 'user' });
    const targetUser = await seedUser({ email: 'target@test.com', role: 'user' });
    const client = await seedClient();
    const allowedProject = await seedProject({ clientId: client.id, name: 'Allowed' });
    const otherProject = await seedProject({ clientId: client.id, name: 'Other' });
    const taskOutside = await seedTask({ projectId: otherProject.id });
    await seedPermissionFlag(flagUser.id, [allowedProject.id]);
    const { id } = await seedAssignment(targetUser.id, taskOutside.id);

    const token = await login(flagUser.email, flagUser.plainPassword);
    const res = await request(app)
      .put(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    // assignment is outside their scoped projects → 404 (not visible) or 403
    expect([403, 404]).toContain(res.status);
  });
});

// ── Deactivation hides task from user's task list ─────────────────────────────

describe('Deactivating assignment hides task from user dropdowns', () => {
  it('GET /tasks with user_id filter excludes tasks with inactive assignments', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id, name: 'Assigned Task' });
    const { id: assignmentId } = await seedAssignment(user.id, task.id, true);

    const adminToken = await login(admin.email, admin.plainPassword);
    const userToken = await login(user.email, user.plainPassword);

    // Task is visible to the user while assignment is active
    const beforeRes = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${userToken}`);

    expect(beforeRes.status).toBe(200);
    const taskIds = (beforeRes.body.data as Array<{ id: number }>).map((t) => t.id);
    expect(taskIds).toContain(task.id);

    // Deactivate the assignment (admin action)
    await request(app)
      .put(`/assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_active: false });

    // Task should no longer appear for the user
    const afterRes = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${userToken}`);

    expect(afterRes.status).toBe(200);
    const taskIdsAfter = (afterRes.body.data as Array<{ id: number }>).map((t) => t.id);
    expect(taskIdsAfter).not.toContain(task.id);
  });
});

// ── Audit log ─────────────────────────────────────────────────────────────────

describe('Audit log for assignment mutations', () => {
  it('POST /assignments writes an audit log entry', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id, task_id: task.id });

    expect(res.status).toBe(201);

    const log = await db('audit_logs')
      .where({ target_entity_type: 'ASSIGNMENT', action: 'CREATE', target_entity_id: res.body.data.id })
      .first();

    expect(log).toBeDefined();
    expect(log.actor_user_id).toBe(admin.id);
  });

  it('PUT /assignments/:id writes an audit log entry on toggle', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const { id } = await seedAssignment(user.id, task.id);

    const token = await login(admin.email, admin.plainPassword);
    await request(app)
      .put(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    const log = await db('audit_logs')
      .where({ target_entity_type: 'ASSIGNMENT', target_entity_id: id })
      .orderBy('timestamp', 'desc')
      .first();

    expect(log).toBeDefined();
    expect(log.actor_user_id).toBe(admin.id);
  });

  it('PUT /assignments/:id stores old and new values in audit log', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const { id } = await seedAssignment(user.id, task.id, true);

    const token = await login(admin.email, admin.plainPassword);
    await request(app)
      .put(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    const log = await db('audit_logs')
      .where({ target_entity_type: 'ASSIGNMENT', target_entity_id: id, action: 'UPDATE' })
      .first();

    expect(log).toBeDefined();
    const oldVal = typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value;
    const newVal = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value;
    expect(oldVal.isActive).toBe(true);
    expect(newVal.isActive).toBe(false);
  });
});

// ── Input validation — GET /assignments ───────────────────────────────────────

describe('GET /assignments — input validation', () => {
  it('400: project_id that is not an integer returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/assignments?project_id=abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('400: project_id=0 returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/assignments?project_id=0')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('400: user_id that is not an integer returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/assignments?user_id=abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('403: regular user cannot filter by another user\'s id', async () => {
    const user1 = await seedUser({ email: 'user1@test.com', role: 'user' });
    const user2 = await seedUser({ email: 'user2@test.com', role: 'user' });

    const token = await login(user1.email, user1.plainPassword);
    const res = await request(app)
      .get(`/assignments?user_id=${user2.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('200: regular user can filter by their own user_id', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    await seedAssignment(user.id, task.id);

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get(`/assignments?user_id=${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('200: admin can filter by both project_id and user_id', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user1 = await seedUser({ email: 'user1@test.com', role: 'user' });
    const user2 = await seedUser({ email: 'user2@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task1 = await seedTask({ projectId: project.id, name: 'Task A' });
    const task2 = await seedTask({ projectId: project.id, name: 'Task B' });
    await seedAssignment(user1.id, task1.id);
    await seedAssignment(user2.id, task2.id);

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get(`/assignments?project_id=${project.id}&user_id=${user1.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe(user1.id);
  });

  it('200: inactive assignments are included in list (no is_active filter by default)', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    await seedAssignment(user.id, task.id, false); // inactive

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/assignments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isActive).toBe(false);
  });
});

// ── Input validation — GET /assignments/:id ───────────────────────────────────

describe('GET /assignments/:id — input validation', () => {
  it('400: id=0 returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/assignments/0')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('400: non-numeric id returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/assignments/notanumber')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('200: regular user can retrieve their own assignment by id', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const { id } = await seedAssignment(user.id, task.id);

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`);

    // Regular users see only their own, so their own assignment should be found
    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(user.id);
  });

  it('404: regular user cannot retrieve another user\'s assignment by id', async () => {
    const user1 = await seedUser({ email: 'user1@test.com', role: 'user' });
    const user2 = await seedUser({ email: 'user2@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const { id } = await seedAssignment(user2.id, task.id);

    const token = await login(user1.email, user1.plainPassword);
    const res = await request(app)
      .get(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('404: user+flag cannot retrieve assignment outside their scoped projects', async () => {
    const flagUser = await seedUser({ email: 'flag@test.com', role: 'user' });
    const other = await seedUser({ email: 'other@test.com', role: 'user' });
    const client = await seedClient();
    const allowedProject = await seedProject({ clientId: client.id, name: 'Allowed' });
    const otherProject = await seedProject({ clientId: client.id, name: 'Other' });
    const task = await seedTask({ projectId: otherProject.id });
    const { id } = await seedAssignment(other.id, task.id);
    await seedPermissionFlag(flagUser.id, [allowedProject.id]);

    const token = await login(flagUser.email, flagUser.plainPassword);
    const res = await request(app)
      .get(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── Input validation — POST /assignments ─────────────────────────────────────

describe('POST /assignments — input validation', () => {
  it('400: missing user_id returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: task.id });

    expect(res.status).toBe(400);
  });

  it('400: missing task_id returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id });

    expect(res.status).toBe(400);
  });

  it('400: user_id=0 returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: 0, task_id: task.id });

    expect(res.status).toBe(400);
  });

  it('400: task_id=0 returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id, task_id: 0 });

    expect(res.status).toBe(400);
  });

  it('404: non-existent task returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id, task_id: 99999 });

    expect(res.status).toBe(404);
  });

  it('404: non-existent user returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: 99999, task_id: task.id });

    expect(res.status).toBe(404);
  });

  it('404: inactive user returns 404 when assigned', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const inactiveUser = await seedUser({ email: 'inactive@test.com', role: 'user', isActive: false });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: inactiveUser.id, task_id: task.id });

    expect(res.status).toBe(404);
  });

  it('403: user+flag with empty scoped_project_ids cannot assign any task', async () => {
    const flagUser = await seedUser({ email: 'flag@test.com', role: 'user' });
    const targetUser = await seedUser({ email: 'target@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    await seedPermissionFlag(flagUser.id, []); // flag exists but no scoped projects

    const token = await login(flagUser.email, flagUser.plainPassword);
    const res = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: targetUser.id, task_id: task.id });

    expect(res.status).toBe(403);
  });
});

// ── Input validation — PUT /assignments/:id ───────────────────────────────────

describe('PUT /assignments/:id — input validation', () => {
  it('400: id=0 returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put('/assignments/0')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(400);
  });

  it('400: is_active as string "false" returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const { id } = await seedAssignment(user.id, task.id);

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .put(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: 'false' });

    expect(res.status).toBe(400);
  });

  it('200: admin can toggle is_active from false back to true', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const { id } = await seedAssignment(user.id, task.id, false); // starts inactive

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .put(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);
  });

  it('200: response contains full joined fields after toggle', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user', firstName: 'Bob', lastName: 'Smith' });
    const client = await seedClient('Big Corp');
    const project = await seedProject({ clientId: client.id, name: 'Beta' });
    const task = await seedTask({ projectId: project.id, name: 'API Work' });
    const { id } = await seedAssignment(user.id, task.id);

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .put(`/assignments/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.data.user.firstName).toBe('Bob');
    expect(res.body.data.task.name).toBe('API Work');
    expect(res.body.data.projectName).toBe('Beta');
    expect(res.body.data.clientName).toBe('Big Corp');
    expect(res.body.data.isActive).toBe(false);
  });
});

// ── Multiple assignments per user ─────────────────────────────────────────────

describe('Multiple assignments', () => {
  it('user can have active assignments to multiple tasks', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task1 = await seedTask({ projectId: project.id, name: 'Task 1' });
    const task2 = await seedTask({ projectId: project.id, name: 'Task 2' });
    const task3 = await seedTask({ projectId: project.id, name: 'Task 3' });
    await seedAssignment(user.id, task1.id);
    await seedAssignment(user.id, task2.id);
    await seedAssignment(user.id, task3.id);

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get(`/assignments?user_id=${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  it('same task can be assigned to multiple different users', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user1 = await seedUser({ email: 'user1@test.com', role: 'user' });
    const user2 = await seedUser({ email: 'user2@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    await seedAssignment(user1.id, task.id);
    await seedAssignment(user2.id, task.id);

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get(`/assignments?project_id=${project.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const userIds = res.body.data.map((a: { userId: number }) => a.userId);
    expect(userIds).toContain(user1.id);
    expect(userIds).toContain(user2.id);
  });
});

// ── DELETE /assignments/:id ───────────────────────────────────────────────────

describe('DELETE /assignments/:id', () => {
  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app).delete('/assignments/1');
    expect(res.status).toBe(401);
  });

  it('200: admin can soft-delete (deactivate) an assignment', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const assignment = await seedAssignment(user.id, task.id, true);

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .delete(`/assignments/${assignment.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.id).toBe(assignment.id);
  });

  it('200: response includes full joined fields', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'bob@test.com', role: 'user', firstName: 'Bob', lastName: 'Smith' });
    const client = await seedClient('Corp Inc');
    const project = await seedProject({ clientId: client.id, name: 'Alpha' });
    const task = await seedTask({ projectId: project.id, name: 'Design Work' });
    const assignment = await seedAssignment(user.id, task.id);

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .delete(`/assignments/${assignment.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.firstName).toBe('Bob');
    expect(res.body.data.task.name).toBe('Design Work');
    expect(res.body.data.projectName).toBe('Alpha');
    expect(res.body.data.clientName).toBe('Corp Inc');
    expect(res.body.data.isActive).toBe(false);
  });

  it('404: non-existent assignment returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .delete('/assignments/99999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('400: invalid id (non-numeric) returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .delete('/assignments/abc')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400: id=0 returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .delete('/assignments/0')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('403: regular user without flag is rejected', async () => {
    await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const assignment = await seedAssignment(user.id, task.id);

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .delete(`/assignments/${assignment.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200: user+flag can delete assignment within scoped project', async () => {
    await seedUser({ email: 'admin@test.com', role: 'admin' });
    const actor = await seedUser({ email: 'actor@test.com', role: 'user' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const assignment = await seedAssignment(target.id, task.id);
    await seedPermissionFlag(actor.id, [project.id]);

    const token = await login(actor.email, actor.plainPassword);
    const res = await request(app)
      .delete(`/assignments/${assignment.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('404: user+flag cannot delete assignment outside scoped project', async () => {
    await seedUser({ email: 'admin@test.com', role: 'admin' });
    const actor = await seedUser({ email: 'actor@test.com', role: 'user' });
    const target = await seedUser({ email: 'target@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const otherProject = await seedProject({ clientId: client.id, name: 'Other Project' });
    const task = await seedTask({ projectId: otherProject.id });
    const assignment = await seedAssignment(target.id, task.id);
    await seedPermissionFlag(actor.id, [project.id]); // scoped to different project

    const token = await login(actor.email, actor.plainPassword);
    const res = await request(app)
      .delete(`/assignments/${assignment.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('audit log: DELETE creates a log entry with action DELETE', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const assignment = await seedAssignment(user.id, task.id);

    const token = await login(admin.email, admin.plainPassword);
    await request(app)
      .delete(`/assignments/${assignment.id}`)
      .set('Authorization', `Bearer ${token}`);

    const log = await db('audit_logs')
      .where({ action: 'DELETE', target_entity_type: 'ASSIGNMENT', target_entity_id: assignment.id })
      .first();
    expect(log).toBeDefined();
    expect(log.actor_user_id).toBe(admin.id);
  });

  it('200: idempotent — deleting an already-inactive assignment returns 200 with isActive=false', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const assignment = await seedAssignment(user.id, task.id, false); // already inactive

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .delete(`/assignments/${assignment.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('after DELETE, POST can re-create (reactivate) the same assignment', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask({ projectId: project.id });
    const assignment = await seedAssignment(user.id, task.id);

    const token = await login(admin.email, admin.plainPassword);

    // Soft-delete via DELETE
    const delRes = await request(app)
      .delete(`/assignments/${assignment.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.isActive).toBe(false);

    // Re-create via POST — should reactivate the row, not create a new one
    const postRes = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id, task_id: task.id });
    expect(postRes.status).toBe(201);
    expect(postRes.body.data.isActive).toBe(true);
    expect(postRes.body.data.id).toBe(assignment.id); // same row reactivated
  });
});
