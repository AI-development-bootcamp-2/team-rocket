// @ts-nocheck
/**
 * Migration: 021_add_absence_deleted_at
 * Adds soft-delete support to absence_entries so DELETE /absences can
 * mark rows as deleted without losing auditability or attachments history.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('absence_entries', (table) => {
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('absence_entries', (table) => {
    table.dropColumn('deleted_at');
  });
};

