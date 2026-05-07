/**
 * Migration: 016_create_refresh_tokens
 * - Mandatory for JWT rotation and session invalidation (GAP-48)
 * - token_hash CHAR(64) UNIQUE — stores hashed refresh token (SHA-256)
 * - revoked_at nullable — set on logout or token rotation
 */
exports.up = async function (knex) {
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.specificType('token_hash', 'CHAR(64)').notNullable().unique();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('revoked_at', { useTz: true }).nullable();
    table.string('ip_address', 45).nullable();
    table.text('user_agent').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('refresh_tokens');
};
