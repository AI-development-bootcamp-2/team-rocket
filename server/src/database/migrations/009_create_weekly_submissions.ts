// @ts-nocheck
/**
 * Migration: 009_create_weekly_submissions
 * - status ENUM: 'draft', 'submitted', 'approved', 'rejected', 'missing'
 * - actioned_by + actioned_at replace reviewed_by + reviewed_at (GAP-32)
 *   populated on both APPROVE and REJECT; check status column to determine which
 */
exports.up = async function (knex) {
  await knex.raw(`CREATE TYPE weekly_submission_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'missing')`);

  await knex.schema.createTable('weekly_submissions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.date('week_start_date').notNullable();
    table.specificType('status', 'weekly_submission_status').notNullable().defaultTo('draft');
    table.timestamp('submitted_at', { useTz: true }).nullable();
    // populated on both APPROVE and REJECT; check status column to determine which
    table.integer('actioned_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('actioned_at', { useTz: true }).nullable();
    table.text('rejection_reason').nullable();
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('weekly_submissions');
  await knex.raw(`DROP TYPE IF EXISTS weekly_submission_status`);
};

