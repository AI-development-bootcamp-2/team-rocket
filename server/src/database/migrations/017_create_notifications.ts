// @ts-nocheck
/**
 * Migration: 017_create_notifications
 * - TIMER_AUTO_STOPPED is a distinct type from TIMER_LONG_RUNNING (GAP-52)
 * - related_entity_type + related_entity_id allow linking to any entity
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE TYPE notification_type AS ENUM (
      'WEEK_REJECTED',
      'MISSING_REPORT',
      'ADMIN_EDIT',
      'LOCKED_MONTH',
      'TIMER_LONG_RUNNING',
      'TIMER_AUTO_STOPPED',
      'QUOTA_WARNING'
    )
  `);

  await knex.schema.createTable('notifications', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.specificType('type', 'notification_type').notNullable();
    table.text('title').notNullable();
    table.text('body').notNullable();
    table.string('related_entity_type', 50).nullable();
    table.integer('related_entity_id').nullable();
    table.boolean('is_read').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('notifications');
  await knex.raw(`DROP TYPE IF EXISTS notification_type`);
};

