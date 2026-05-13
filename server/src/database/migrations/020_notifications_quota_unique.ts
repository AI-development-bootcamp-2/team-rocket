// @ts-nocheck
/**
 * Migration: 020_notifications_quota_unique
 * Adds a partial unique index on notifications so that only one
 * QUOTA_WARNING row can exist per (user_id, related_entity_type, related_entity_id).
 * This lets checkQuotaWarning use INSERT … ON CONFLICT DO NOTHING atomically.
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_quota_warning
    ON notifications (user_id, related_entity_type, related_entity_id)
    WHERE type = 'QUOTA_WARNING'
  `);
};

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS uq_notifications_quota_warning`);
};

