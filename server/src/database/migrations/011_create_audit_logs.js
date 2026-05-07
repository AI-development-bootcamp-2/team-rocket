/**
 * Migration: 011_create_audit_logs
 * - target_entity_type ENUM: 12 entity types
 * - action ENUM: 17 action types
 * - ENTRY_CORRECTED = user edits their own previously-rejected entry (GAP-15)
 * - ADMIN_EDIT = admin edits a user's entry (GAP-36)
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE TYPE audit_entity_type AS ENUM (
      'USER', 'CLIENT', 'PROJECT', 'TASK', 'ASSIGNMENT',
      'TIME_ENTRY', 'ABSENCE', 'WEEKLY_SUBMISSION',
      'MONTH_LOCK', 'SETTING', 'HOLIDAY', 'TIMER'
    )
  `);
  await knex.raw(`
    CREATE TYPE audit_action AS ENUM (
      'LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'SUBMIT',
      'APPROVE', 'REJECT', 'LOCK', 'UNLOCK', 'ADMIN_EDIT',
      'TIMER_AUTO_STOPPED', 'WEEK_RESUBMITTED', 'EXPORT',
      'PASSWORD_RESET', 'DEACTIVATE', 'ENTRY_CORRECTED'
    )
  `);

  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('actor_user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.specificType('target_entity_type', 'audit_entity_type').notNullable();
    table.integer('target_entity_id').nullable();
    table.specificType('action', 'audit_action').notNullable();
    table.jsonb('old_value').nullable();
    table.jsonb('new_value').nullable();
    table.text('reason').nullable();
    table.timestamp('timestamp', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.string('ip_address', 45).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.raw(`DROP TYPE IF EXISTS audit_action`);
  await knex.raw(`DROP TYPE IF EXISTS audit_entity_type`);
};
