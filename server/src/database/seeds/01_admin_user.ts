// @ts-nocheck
/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require('bcryptjs');

/**
 * Seed: 01_admin_user
 * Creates the default system admin user.
 * Password is a temporary value — must_change_password is set to true,
 * forcing a password reset on first login.
 *
 * Default credentials (change immediately after first login):
 *   email:    admin@system.com
 *   password: Admin1234!
 */
exports.seed = async function (knex) {
  // Skip if admin already exists
  const existing = await knex('users').where({ email: 'admin@system.com' }).first();
  if (existing) return;

  const passwordHash = await bcrypt.hash('Admin1234!', 12);

  await knex('users').insert({
    email: 'admin@system.com',
    password_hash: passwordHash,
    first_name: 'System',
    last_name: 'Admin',
    role: 'admin',
    is_active: true,
    must_change_password: true,
    failed_login_attempts: 0,
    lockout_until: null,
    employment_percentage: 100,
    created_at: new Date(),
    updated_at: new Date(),
  });
};

