/**
 * Integration tests — Projects module (F06-BE)
 *
 * Requires a running Postgres instance at DATABASE_URL (set in tests/setup.ts).
 *
 * Isolation: beforeEach truncates users + audit_logs CASCADE, then clients + projects CASCADE.
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
  // users CASCADE drops refresh_tokens, permission_flags, user_task_assignments, time_entries, etc.
  // clients CASCADE drops projects (FK), which CASCADE drops tasks.
  await db.raw(
    'TRUNCATE users, audit_logs, clients RESTART IDENTITY CASCADE',
  );
}

interface UserSeed {
  email?: string;
  password?: string;
  role?: 'admin' | 'user';
  isActive?: boolean;
}

async function seedUser(
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
      employment_percentage: 100,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'email'])) as Array<{ id: number; email: string }>;

  return { id: row.id, email: row.email, plainPassword: password };
}

async function seedClient(name = 'Test Client', isActive = true): Promise<{ id: number }> {
  const [row] = (await db('clients')
    .insert({
      name,
      is_active: isActive,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedProject(seed: {
  name?: string;
  clientId?: number;
  isActive?: boolean;
} = {}): Promise<{ id: number }> {
  const clientId = seed.clientId ?? (await seedClient()).id;
  const [row] = (await db('projects')
    .insert({
      client_id: clientId,
      name: seed.name ?? 'Test Project',
      is_active: seed.isActive ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function seedTask(projectId: number, name = 'Test Task'): Promise<{ id: number }> {
  const [row] = (await db('tasks')
    .insert({
      project_id: projectId,
      name,
      status: 'open',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;
  return row;
}

async function assignTask(userId: number, taskId: number): Promise<void> {
  await db('user_task_assignments').insert({
    user_id: userId,
    task_id: taskId,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

// Logs in and returns Bearer token
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
// GET /projects
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /projects', () => {
  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app).get('/projects');
    expect(res.status).toBe(401);
  });

  it('200 (admin): returns all projects regardless of assignment', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient();
    await seedProject({ name: 'Alpha', clientId: client.id });
    await seedProject({ name: 'Beta', clientId: client.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('200 (user): sees only projects with assigned tasks', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const assigned = await seedProject({ name: 'Assigned', clientId: client.id });
    await seedProject({ name: 'Unassigned', clientId: client.id });

    const task = await seedTask(assigned.id);
    await assignTask(user.id, task.id);

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Assigned');
  });

  it('200: admin can filter by client_id', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const c1 = await seedClient('Client 1');
    const c2 = await seedClient('Client 2');
    await seedProject({ name: 'C1 Project', clientId: c1.id });
    await seedProject({ name: 'C2 Project', clientId: c2.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get(`/projects?client_id=${c1.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('C1 Project');
  });

  it('200: admin can filter by is_active=false', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient();
    await seedProject({ name: 'Active', clientId: client.id, isActive: true });
    await seedProject({ name: 'Archived', clientId: client.id, isActive: false });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/projects?is_active=false')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Archived');
  });

  it('400: invalid is_active value returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/projects?is_active=maybe')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /projects/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /projects/:id', () => {
  it('200 (admin): returns project with tasks list', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    await seedTask(project.id, 'Task One');
    await seedTask(project.id, 'Task Two');

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(2);
  });

  it('404 (user): returns 404 for project with no assigned tasks', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    await seedTask(project.id); // task exists but NOT assigned to this user

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('404: non-existent project returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/projects/99999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /projects
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /projects', () => {
  it('403: non-admin cannot create a project', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Project', client_id: client.id });

    expect(res.status).toBe(403);
  });

  it('201: admin creates a project — requires valid client_id', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient();
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Project', client_id: client.id });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('New Project');
    expect(res.body.data.clientId).toBe(client.id);
    expect(res.body.data.isActive).toBe(true);
  });

  it('400: missing client_id returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'No Client' });

    expect(res.status).toBe(400);
  });

  it('201 + warning: duplicate name under same client warns but allows creation', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient();
    await seedProject({ name: 'Duplicate', clientId: client.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Duplicate', client_id: client.id });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.warning).toBe('string');
  });

  it('201: duplicate name under DIFFERENT client has no warning', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const c1 = await seedClient('Client A');
    const c2 = await seedClient('Client B');
    await seedProject({ name: 'Same Name', clientId: c1.id });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Same Name', client_id: c2.id });

    expect(res.status).toBe(201);
    expect(res.body.warning).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /projects/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /projects/:id', () => {
  it('403: non-admin cannot update a project', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const project = await seedProject();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .put(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(403);
  });

  it('200: admin can update project name', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject({ name: 'Original' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('404: updating non-existent project returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put('/projects/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /projects/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /projects/:id', () => {
  it('403: non-admin cannot archive a project', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const project = await seedProject();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .delete(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('200: admin soft-deletes project — sets is_active=false', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject();
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .delete(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    // Verify in DB
    const row = await db('projects').where('id', project.id).first();
    expect(row.is_active).toBe(false);
  });

  it('200 + warning: archiving project with tasks returns a warning', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject();
    await seedTask(project.id, 'Task A');
    await seedTask(project.id, 'Task B');
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .delete(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.warning).toBe('string');
    expect(res.body.warning).toContain('2');
  });

  it('200: archived project excluded from GET /projects (is_active=true filter)', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject();
    const token = await login(admin.email, admin.plainPassword);

    await request(app)
      .delete(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`);

    const listRes = await request(app)
      .get('/projects?is_active=true')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body.data.find((p: { id: number }) => p.id === project.id)).toBeUndefined();
  });

  it('404: archiving non-existent project returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .delete('/projects/99999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('removes projectId from permission_flags.scoped_project_ids on archive', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const project = await seedProject();
    const token = await login(admin.email, admin.plainPassword);

    // Grant user a flag scoped to this project
    await db('permission_flags').insert({
      user_id: user.id,
      flag_name: 'canAssignProjectTasks',
      scoped_project_ids: JSON.stringify([project.id]),
      created_at: new Date(),
    });

    const res = await request(app)
      .delete(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const flag = await db('permission_flags').where({ user_id: user.id }).first();
    const ids: number[] =
      typeof flag.scoped_project_ids === 'string'
        ? JSON.parse(flag.scoped_project_ids)
        : (flag.scoped_project_ids ?? []);
    expect(ids).not.toContain(project.id);
  });

  it('creates audit log entry on archive', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject();
    const token = await login(admin.email, admin.plainPassword);

    await request(app)
      .delete(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`);

    const log = await db('audit_logs')
      .where({ action: 'DELETE', target_entity_type: 'PROJECT', target_entity_id: project.id })
      .first();
    expect(log).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional coverage: auth, audit, manager, client validation
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /projects/:id — user with assignment', () => {
  it('200 (user): returns project when user has an assigned task on it', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const task = await seedTask(project.id, 'My Task');
    await assignTask(user.id, task.id);

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(project.id);
    expect(res.body.data.tasks).toHaveLength(1);
  });
});

describe('POST /projects — validation & audit', () => {
  it('400: non-existent client_id returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost Client Project', client_id: 99999 });

    expect(res.status).toBe(400);
  });

  it('201: stores manager_user_id and returns managerUserId in response', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const manager = await seedUser({ email: 'mgr@test.com', role: 'user' });
    const client = await seedClient();
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Managed Project', client_id: client.id, manager_user_id: manager.id });

    expect(res.status).toBe(201);
    expect(res.body.data.managerUserId).toBe(manager.id);
  });

  it('creates audit log entry on project creation', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient();
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Audited Project', client_id: client.id });

    expect(res.status).toBe(201);
    const log = await db('audit_logs')
      .where({ action: 'CREATE', target_entity_type: 'PROJECT', target_entity_id: res.body.data.id })
      .first();
    expect(log).toBeDefined();
    expect(log.actor_user_id).toBeTruthy();
  });

  it('403: user with canAssignProjectTasks flag cannot create a project', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();

    await db('permission_flags').insert({
      user_id: user.id,
      flag_name: 'canAssignProjectTasks',
      scoped_project_ids: JSON.stringify([]),
      created_at: new Date(),
    });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sneaky Project', client_id: client.id });

    expect(res.status).toBe(403);
  });
});

describe('PUT /projects/:id — validation & audit', () => {
  it('400: updating to a non-existent client_id returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject();
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: 99999 });

    expect(res.status).toBe(400);
  });

  it('creates audit log entry on project update', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject({ name: 'Before' });
    const token = await login(admin.email, admin.plainPassword);

    await request(app)
      .put(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'After' });

    const log = await db('audit_logs')
      .where({ action: 'UPDATE', target_entity_type: 'PROJECT', target_entity_id: project.id })
      .first();
    expect(log).toBeDefined();
  });
});
