/**
 * Integration tests - Tasks module (F07-BE)
 *
 * Requires a running Postgres instance at DATABASE_URL (set in tests/setup.ts).
 *
 * Isolation: beforeEach truncates users + audit_logs CASCADE, then clients CASCADE.
 * RESTART IDENTITY resets id sequences so IDs start at 1 in every test.
 */
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

async function assignTask(userId: number, taskId: number, isActive = true): Promise<void> {
  await db('user_task_assignments').insert({
    user_id: userId,
    task_id: taskId,
    is_active: isActive,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

async function seedTimeEntry(seed: {
  userId: number;
  clientId: number;
  projectId: number;
  taskId: number;
}): Promise<{ id: number }> {
  const [row] = (await db('time_entries')
    .insert({
      user_id: seed.userId,
      date: '2026-05-01',
      start_time: '09:00:00',
      end_time: '10:00:00',
      duration_minutes: 60,
      client_id: seed.clientId,
      project_id: seed.projectId,
      task_id: seed.taskId,
      location: 'office',
      status: 'draft',
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

beforeAll(async () => {
  await db.migrate.latest();
});

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await db.destroy();
});

describe('GET /tasks', () => {
  it('401: unauthenticated request is rejected', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(401);
  });

  it('200: GET /tasks does not return closed tasks when status=open filter is applied', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient('Client A');
    const projectOne = await seedProject({ name: 'Project One', clientId: client.id });
    const projectTwo = await seedProject({ name: 'Project Two', clientId: client.id });
    await seedTask({ projectId: projectOne.id, name: 'Open Task', status: 'open' });
    await seedTask({ projectId: projectOne.id, name: 'Closed Task', status: 'closed' });
    await seedTask({ projectId: projectTwo.id, name: 'Other Project Task', status: 'open' });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get(`/tasks?project_id=${projectOne.id}&status=open`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      name: 'Open Task',
      status: 'open',
      projectId: projectOne.id,
      projectName: 'Project One',
      clientName: 'Client A',
      assignedUsersCount: 0,
    });
  });

  it('200 (user): returns only actively assigned tasks', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient();
    const project = await seedProject({ clientId: client.id });
    const assignedTask = await seedTask({ projectId: project.id, name: 'Assigned Task' });
    const unassignedTask = await seedTask({ projectId: project.id, name: 'Unassigned Task' });
    const inactiveTask = await seedTask({ projectId: project.id, name: 'Inactive Assignment Task' });

    await assignTask(user.id, assignedTask.id, true);
    await assignTask(user.id, inactiveTask.id, false);
    await assignTask((await seedUser({ email: 'other@test.com', role: 'user' })).id, unassignedTask.id, true);

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Assigned Task');
    expect(res.body.data[0].assignedUsersCount).toBe(1);
  });
});

describe('GET /tasks/:id', () => {
  it('200 (admin): returns task details with parent project and client names', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient('Important Client');
    const project = await seedProject({ clientId: client.id, name: 'Delivery Project' });
    const task = await seedTask({ projectId: project.id, name: 'Prepare Release' });

    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: task.id,
      name: 'Prepare Release',
      projectId: project.id,
      projectName: 'Delivery Project',
      clientName: 'Important Client',
      status: 'open',
      assignedUsersCount: 0,
    });
  });

  it('404 (user): returns 404 when task is not assigned to the caller', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const project = await seedProject();
    const task = await seedTask({ projectId: project.id, name: 'Hidden Task' });

    const token = await login(user.email, user.plainPassword);
    const res = await request(app)
      .get(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('404: non-existent task returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);
    const res = await request(app)
      .get('/tasks/99999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /tasks', () => {
  it('403: non-admin cannot create a task', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const project = await seedProject();
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ project_id: project.id, name: 'Blocked Task' });

    expect(res.status).toBe(403);
  });

  it('201: admin creates a task with default status=open', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient('Client A');
    const project = await seedProject({ clientId: client.id, name: 'Launch Project' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        project_id: project.id,
        name: 'Kickoff Task',
        start_date: '2026-05-10',
        end_date: '2026-05-20',
        description: 'Prepare the kickoff materials',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Kickoff Task',
      projectId: project.id,
      projectName: 'Launch Project',
      clientName: 'Client A',
      status: 'open',
      startDate: '2026-05-10',
      endDate: '2026-05-20',
      description: 'Prepare the kickoff materials',
    });

    const log = await db('audit_logs')
      .where({
        action: 'CREATE',
        target_entity_type: 'TASK',
        target_entity_id: res.body.data.id,
      })
      .first();
    expect(log).toBeDefined();
  });

  it('400: task requires a valid project_id', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ project_id: 99999, name: 'Ghost Project Task' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('project_id does not exist');
  });
});

describe('PUT /tasks/:id', () => {
  it('403: non-admin cannot update a task', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const project = await seedProject();
    const task = await seedTask({ projectId: project.id });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Blocked Update' });

    expect(res.status).toBe(403);
  });

  it('200: admin updates task fields and creates an audit log entry', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject({ name: 'Original Project' });
    const task = await seedTask({ projectId: project.id, name: 'Before' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'After',
        status: 'closed',
        start_date: '2026-05-11',
        end_date: '2026-05-30',
        description: 'Updated description',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: task.id,
      name: 'After',
      status: 'closed',
      startDate: '2026-05-11',
      endDate: '2026-05-30',
      description: 'Updated description',
    });

    const log = await db('audit_logs')
      .where({
        action: 'UPDATE',
        target_entity_type: 'TASK',
        target_entity_id: task.id,
      })
      .first();
    expect(log).toBeDefined();
  });

  it('404: updating a non-existent task returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put('/tasks/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost Task' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /tasks/:id', () => {
  it('403: non-admin cannot close a task', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const project = await seedProject();
    const task = await seedTask({ projectId: project.id });
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .delete(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('200: closing a task sets status=closed and preserves assignments and time entries', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const worker = await seedUser({ email: 'worker@test.com', role: 'user' });
    const client = await seedClient('Client A');
    const project = await seedProject({ clientId: client.id, name: 'Archive Project' });
    const task = await seedTask({ projectId: project.id, name: 'Close Me' });
    await assignTask(worker.id, task.id, true);
    const timeEntry = await seedTimeEntry({
      userId: worker.id,
      clientId: client.id,
      projectId: project.id,
      taskId: task.id,
    });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .delete(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('closed');
    const taskRow = await db('tasks').where({ id: task.id }).first();
    expect(taskRow).toBeDefined();
    expect(taskRow.status).toBe('closed');

    const assignment = await db('user_task_assignments')
      .where({ user_id: worker.id, task_id: task.id })
      .first();
    expect(assignment).toBeDefined();
    expect(assignment.is_active).toBe(true);

    const persistedTimeEntry = await db('time_entries').where({ id: timeEntry.id }).first();
    expect(persistedTimeEntry).toBeDefined();
    expect(persistedTimeEntry.task_id).toBe(task.id);

    const log = await db('audit_logs')
      .where({
        action: 'DELETE',
        target_entity_type: 'TASK',
        target_entity_id: task.id,
      })
      .first();
    expect(log).toBeDefined();
  });

  it('404: closing a non-existent task returns 404', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .delete('/tasks/99999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('200: closing an already-closed task is idempotent', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject();
    const task = await seedTask({ projectId: project.id, status: 'closed' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .delete(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('closed');
  });
});

describe('GET /tasks — query validation', () => {
  it('400: invalid status query param returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/tasks?status=invalid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('status must be open or closed');
  });

  it('400: non-integer project_id query param returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/tasks?project_id=abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('project_id must be a positive integer');
  });

  it('200: filter by project_id returns only tasks for that project', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const client = await seedClient();
    const projectA = await seedProject({ name: 'Project A', clientId: client.id });
    const projectB = await seedProject({ name: 'Project B', clientId: client.id });
    await seedTask({ projectId: projectA.id, name: 'Task in A' });
    await seedTask({ projectId: projectB.id, name: 'Task in B' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get(`/tasks?project_id=${projectA.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Task in A');
  });

  it('200: filter by status=closed returns only closed tasks', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject();
    await seedTask({ projectId: project.id, name: 'Open Task', status: 'open' });
    await seedTask({ projectId: project.id, name: 'Closed Task', status: 'closed' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .get('/tasks?status=closed')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Closed Task');
    expect(res.body.data[0].status).toBe('closed');
  });
});

describe('GET /tasks/:id — user access', () => {
  it('200 (user): user with active assignment can fetch task details', async () => {
    const user = await seedUser({ email: 'user@test.com', role: 'user' });
    const client = await seedClient('My Client');
    const project = await seedProject({ clientId: client.id, name: 'My Project' });
    const task = await seedTask({ projectId: project.id, name: 'My Task' });
    await assignTask(user.id, task.id, true);
    const token = await login(user.email, user.plainPassword);

    const res = await request(app)
      .get(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: task.id,
      name: 'My Task',
      projectName: 'My Project',
      clientName: 'My Client',
    });
  });
});

describe('POST /tasks — validation', () => {
  it('400: missing name returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject();
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ project_id: project.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name is required');
  });

  it('400: empty/whitespace name returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject();
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ project_id: project.id, name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name is required');
  });
});

describe('PUT /tasks/:id — validation', () => {
  it('400: empty name returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject();
    const task = await seedTask({ projectId: project.id });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name cannot be empty');
  });

  it('400: invalid status value returns 400', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject();
    const task = await seedTask({ projectId: project.id });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'archived' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('status must be open or closed');
  });

  it('200: admin can reopen a closed task', async () => {
    const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
    const project = await seedProject();
    const task = await seedTask({ projectId: project.id, status: 'closed' });
    const token = await login(admin.email, admin.plainPassword);

    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'open' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('open');
  });
});
