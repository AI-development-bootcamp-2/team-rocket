// @ts-nocheck
/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
const knex = require('knex');
const fs = require('fs');
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const pool = env === 'test' ? { min: 0, max: 5 } : { min: 2, max: 10 };

const connection = process.env.DATABASE_URL
  ? process.env.DATABASE_URL
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'time_reporting',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };

// Resolve migrations directory whether running from src (ts-node) or dist (node)
const migrationsDirectory = path.resolve(__dirname, '../../src/database/migrations');

const migrationSource = {
  getMigrations() {
    return fs
      .readdirSync(migrationsDirectory)
      .filter((name) => name.endsWith('.ts'))
      .sort()
      .map((name) => ({ name, filepath: path.join(migrationsDirectory, name) }));
  },
  getMigrationName(migration) {
    return migration.name.replace(/\.ts$/, '.js');
  },
  getMigration(migration) {
    return require(migration.filepath);
  },
};

const db = knex({
  client: 'postgresql',
  connection,
  pool,
  migrations: { tableName: 'knex_migrations', migrationSource },
});

module.exports = db;

