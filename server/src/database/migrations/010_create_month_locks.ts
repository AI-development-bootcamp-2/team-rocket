// @ts-nocheck
/**
 * Migration: 010_create_month_locks
 * - UNIQUE constraint on (year, month) prevents race-condition double-lock (GAP-49)
 * - unlock_reason stored when admin unlocks a month
 * - unlocked_by + unlocked_at nullable (populated only on unlock)
 */
exports.up = async function (knex) {
  await knex.schema.createTable('month_locks', (table) => {
    table.increments('id').primary();
    table.integer('year').notNullable();
    table.integer('month').notNullable();
    table.integer('locked_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.timestamp('locked_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.integer('unlocked_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('unlocked_at', { useTz: true }).nullable();
    table.text('unlock_reason').nullable();
    table.boolean('is_locked').notNullable().defaultTo(true);

    table.unique(['year', 'month'], { indexName: 'uq_month_locks_year_month' });
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('month_locks');
};

