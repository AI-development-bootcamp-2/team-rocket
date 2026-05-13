// @ts-nocheck
/**
 * Migration: 002_create_clients
 * - client_number is optional, UNIQUE when provided (GAP-20)
 */
exports.up = async function (knex) {
  await knex.schema.createTable('clients', (table) => {
    table.increments('id').primary();
    table.string('client_number', 20).unique().nullable();
    table.string('name', 255).notNullable();
    table.text('contact_info').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('clients');
};

