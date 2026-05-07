/**
 * Migration: 008_create_attachments
 * - Linked to absence_entries
 * - uploaded_by references users(id)
 */
exports.up = async function (knex) {
  await knex.schema.createTable('attachments', (table) => {
    table.increments('id').primary();
    table.integer('absence_id').notNullable().references('id').inTable('absence_entries').onDelete('CASCADE');
    table.string('file_name', 255).notNullable();
    table.string('file_path', 500).notNullable();
    table.string('mime_type', 100).notNullable();
    table.integer('size_bytes').notNullable();
    table.integer('uploaded_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('attachments');
};
