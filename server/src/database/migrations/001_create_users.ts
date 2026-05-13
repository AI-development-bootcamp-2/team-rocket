// @ts-nocheck
/**
 * Migration: 001_create_users
 * Creates the users table with all required columns per F02 spec.
 * - role ENUM: 'admin', 'user' (no 'manager' role — GAP-27)
 * - first_name + last_name separate columns, not full_name (GAP-25)
 * - employment_percentage CHECK (0–100)
 * - failed_login_attempts defaults to 0, lockout_until defaults to NULL
 */
exports.up = async function (knex) {
  await knex.raw(`CREATE TYPE user_role AS ENUM ('admin', 'user')`);
  await knex.raw(`CREATE TYPE employment_type AS ENUM ('full_time', 'part_time', 'contractor')`);

  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.specificType('role', 'user_role').notNullable().defaultTo('user');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.boolean('must_change_password').notNullable().defaultTo(false);
    table.integer('failed_login_attempts').notNullable().defaultTo(0);
    table.timestamp('lockout_until', { useTz: true }).nullable();
    table.jsonb('sort_prefs').nullable();
    table.string('employee_number', 20).unique().nullable();
    table.specificType('employment_type', 'employment_type').nullable();
    table
      .specificType('employment_percentage', 'SMALLINT')
      .notNullable()
      .defaultTo(100)
      .checkBetween([0, 100], 'chk_employment_percentage');
    table.string('department', 100).nullable();
    table.specificType('daily_hours_override', 'SMALLINT').nullable();
    table.timestamps(true, true); // created_at, updated_at
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('users');
  await knex.raw(`DROP TYPE IF EXISTS employment_type`);
  await knex.raw(`DROP TYPE IF EXISTS user_role`);
};

