const bcrypt = require('bcryptjs');

/**
 * Seed: 02_test_data
 * Development test data: 5 users, 3 clients, 5 projects, 10 tasks, sample assignments.
 * Only runs in development environment.
 */
exports.seed = async function (knex) {
  if (process.env.NODE_ENV === 'production') {
    console.log('Skipping test data seed in production.');
    return;
  }

  const passwordHash = await bcrypt.hash('Test1234!', 12);
  const now = new Date();

  // ── Users ──────────────────────────────────────────────────────────────────
  const existingUsers = await knex('users').whereIn('email', [
    'alice@example.com', 'bob@example.com', 'carol@example.com',
    'dan@example.com', 'eve@example.com',
  ]);
  if (existingUsers.length > 0) {
    console.log('Test data already exists, skipping.');
    return;
  }

  const [u1, u2, u3, u4, u5] = await knex('users')
    .insert([
      { email: 'alice@example.com',  password_hash: passwordHash, first_name: 'Alice',  last_name: 'Cohen',    role: 'user',  is_active: true, must_change_password: false, failed_login_attempts: 0, employment_percentage: 100, department: 'Engineering', employment_type: 'full_time',  created_at: now, updated_at: now },
      { email: 'bob@example.com',    password_hash: passwordHash, first_name: 'Bob',    last_name: 'Levi',     role: 'user',  is_active: true, must_change_password: false, failed_login_attempts: 0, employment_percentage: 100, department: 'Engineering', employment_type: 'full_time',  created_at: now, updated_at: now },
      { email: 'carol@example.com',  password_hash: passwordHash, first_name: 'Carol',  last_name: 'Mizrahi',  role: 'user',  is_active: true, must_change_password: false, failed_login_attempts: 0, employment_percentage: 50,  department: 'Design',       employment_type: 'part_time',  created_at: now, updated_at: now },
      { email: 'dan@example.com',    password_hash: passwordHash, first_name: 'Dan',    last_name: 'Peretz',   role: 'user',  is_active: true, must_change_password: false, failed_login_attempts: 0, employment_percentage: 100, department: 'QA',           employment_type: 'full_time',  created_at: now, updated_at: now },
      { email: 'eve@example.com',    password_hash: passwordHash, first_name: 'Eve',    last_name: 'Shapiro',  role: 'admin', is_active: true, must_change_password: false, failed_login_attempts: 0, employment_percentage: 100, department: 'Management',   employment_type: 'full_time',  created_at: now, updated_at: now },
    ])
    .returning('id');

  // ── Clients ────────────────────────────────────────────────────────────────
  const [c1, c2, c3] = await knex('clients')
    .insert([
      { client_number: '#001', name: 'Acme Corp',       contact_info: 'contact@acme.com',       is_active: true, created_at: now, updated_at: now },
      { client_number: '#002', name: 'Beta Industries',  contact_info: 'contact@beta.com',       is_active: true, created_at: now, updated_at: now },
      { client_number: '#003', name: 'Gamma Solutions',  contact_info: 'contact@gamma.com',      is_active: true, created_at: now, updated_at: now },
    ])
    .returning('id');

  // ── Projects ───────────────────────────────────────────────────────────────
  const [p1, p2, p3, p4, p5] = await knex('projects')
    .insert([
      { client_id: c1.id, name: 'Acme Website Redesign',     manager_user_id: u5.id, start_date: '2026-01-01', end_date: '2026-06-30', description: 'Full redesign of Acme public website', is_active: true, created_at: now, updated_at: now },
      { client_id: c1.id, name: 'Acme CRM Integration',      manager_user_id: u5.id, start_date: '2026-02-01', end_date: null,         description: 'Integrate CRM with internal tools',   is_active: true, created_at: now, updated_at: now },
      { client_id: c2.id, name: 'Beta Mobile App',           manager_user_id: u5.id, start_date: '2026-01-15', end_date: '2026-09-30', description: 'iOS & Android app for Beta',           is_active: true, created_at: now, updated_at: now },
      { client_id: c3.id, name: 'Gamma Data Pipeline',       manager_user_id: u5.id, start_date: '2026-03-01', end_date: null,         description: 'ETL pipeline for analytics',           is_active: true, created_at: now, updated_at: now },
      { client_id: c3.id, name: 'Gamma Dashboard',           manager_user_id: u5.id, start_date: '2026-04-01', end_date: '2026-12-31', description: 'Admin reporting dashboard',            is_active: true, created_at: now, updated_at: now },
    ])
    .returning('id');

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10] = await knex('tasks')
    .insert([
      { project_id: p1.id, name: 'UI Design',           status: 'open',   start_date: '2026-01-01', end_date: '2026-02-28', description: 'Figma mockups and design system', created_at: now, updated_at: now },
      { project_id: p1.id, name: 'Frontend Development', status: 'open',  start_date: '2026-03-01', end_date: '2026-05-31', description: 'React implementation',            created_at: now, updated_at: now },
      { project_id: p1.id, name: 'QA Testing',           status: 'open',  start_date: '2026-05-01', end_date: '2026-06-30', description: 'Test coverage and bug fixes',      created_at: now, updated_at: now },
      { project_id: p2.id, name: 'API Integration',      status: 'open',  start_date: '2026-02-01', end_date: null,         description: 'REST API connector for CRM',       created_at: now, updated_at: now },
      { project_id: p2.id, name: 'Data Mapping',         status: 'open',  start_date: '2026-02-15', end_date: null,         description: 'Field mapping and transformation', created_at: now, updated_at: now },
      { project_id: p3.id, name: 'iOS Development',      status: 'open',  start_date: '2026-01-15', end_date: '2026-07-31', description: 'Swift native app',                 created_at: now, updated_at: now },
      { project_id: p3.id, name: 'Android Development',  status: 'open',  start_date: '2026-01-15', end_date: '2026-07-31', description: 'Kotlin native app',                created_at: now, updated_at: now },
      { project_id: p4.id, name: 'Pipeline Architecture', status: 'open', start_date: '2026-03-01', end_date: null,         description: 'Design ETL architecture',          created_at: now, updated_at: now },
      { project_id: p4.id, name: 'Data Ingestion',        status: 'open', start_date: '2026-04-01', end_date: null,         description: 'Source connectors',                created_at: now, updated_at: now },
      { project_id: p5.id, name: 'Dashboard UI',          status: 'open', start_date: '2026-04-01', end_date: '2026-10-31', description: 'Charts and reporting views',       created_at: now, updated_at: now },
    ])
    .returning('id');

  // ── User-Task Assignments ──────────────────────────────────────────────────
  await knex('user_task_assignments').insert([
    { user_id: u1.id, task_id: t1.id,  is_active: true, created_at: now, updated_at: now }, // Alice → UI Design
    { user_id: u1.id, task_id: t2.id,  is_active: true, created_at: now, updated_at: now }, // Alice → Frontend Dev
    { user_id: u2.id, task_id: t2.id,  is_active: true, created_at: now, updated_at: now }, // Bob   → Frontend Dev
    { user_id: u2.id, task_id: t4.id,  is_active: true, created_at: now, updated_at: now }, // Bob   → API Integration
    { user_id: u3.id, task_id: t1.id,  is_active: true, created_at: now, updated_at: now }, // Carol → UI Design
    { user_id: u3.id, task_id: t10.id, is_active: true, created_at: now, updated_at: now }, // Carol → Dashboard UI
    { user_id: u4.id, task_id: t3.id,  is_active: true, created_at: now, updated_at: now }, // Dan   → QA Testing
    { user_id: u4.id, task_id: t7.id,  is_active: true, created_at: now, updated_at: now }, // Dan   → Android Dev
    { user_id: u1.id, task_id: t6.id,  is_active: true, created_at: now, updated_at: now }, // Alice → iOS Dev
    { user_id: u2.id, task_id: t8.id,  is_active: true, created_at: now, updated_at: now }, // Bob   → Pipeline Architecture
  ]);

  console.log('Test data seeded successfully.');
};
