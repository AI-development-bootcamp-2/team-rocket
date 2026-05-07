/**
 * Migration: 004_create_tasks
 * - status ENUM: 'open', 'closed'
 * - start_date, end_date, description nullable
 */
exports.up = async function (knex) {
  await knex.raw(`CREATE TYPE task_status AS ENUM ('open', 'closed')`);

  await knex.schema.createTable('tasks', (table) => {
    table.increments('id').primary();
    table.integer('project_id').notNullable().references('id').inTable('projects').onDelete('RESTRICT');
    table.string('name', 255).notNullable();
    table.specificType('status', 'task_status').notNullable().defaultTo('open');
    table.date('start_date').nullable();
    table.date('end_date').nullable();
    table.text('description').nullable();
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tasks');
  await knex.raw(`DROP TYPE IF EXISTS task_status`);
};
