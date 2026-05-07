/**
 * Migration: 012_create_system_settings
 * - key is unique — one value per setting key
 * - value stored as jsonb to support any data type
 */
exports.up = async function (knex) {
  await knex.schema.createTable('system_settings', (table) => {
    table.increments('id').primary();
    table.string('key', 100).notNullable().unique();
    table.jsonb('value').notNullable();
    table.integer('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('system_settings');
};
