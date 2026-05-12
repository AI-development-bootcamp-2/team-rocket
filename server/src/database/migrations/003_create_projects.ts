// @ts-nocheck
/**
 * Migration: 003_create_projects
 * - manager_user_id references users(id), nullable (GAP-27)
 * - start_date, end_date, description all nullable
 */
exports.up = async function (knex) {
  await knex.schema.createTable('projects', (table) => {
    table.increments('id').primary();
    table.integer('client_id').notNullable().references('id').inTable('clients').onDelete('RESTRICT');
    table.string('name', 255).notNullable();
    table.integer('manager_user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.date('start_date').nullable();
    table.date('end_date').nullable();
    table.text('description').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('projects');
};

