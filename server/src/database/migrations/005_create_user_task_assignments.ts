// @ts-nocheck
/**
 * Migration: 005_create_user_task_assignments
 * - UNIQUE constraint on active user+task combination
 * - A user can only have one active assignment per task
 */
exports.up = async function (knex) {
  await knex.schema.createTable('user_task_assignments', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.integer('task_id').notNullable().references('id').inTable('tasks').onDelete('RESTRICT');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  // Unique constraint: only one active assignment per user+task
  await knex.raw(`
    CREATE UNIQUE INDEX uq_active_user_task
    ON user_task_assignments (user_id, task_id)
    WHERE is_active = true
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('user_task_assignments');
};

