// @ts-nocheck
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const migrationsDirectory = path.join(__dirname, 'src/database/migrations');
const seedsDirectory = path.join(__dirname, 'src/database/seeds');

const migrationSource = {
  getMigrations() {
    return fs
      .readdirSync(migrationsDirectory)
      .filter((name) => name.endsWith('.ts'))
      .sort()
      .map((name) => ({
        name,
        filepath: path.join(migrationsDirectory, name),
      }));
  },
  getMigrationName(migration) {
    return migration.name.replace(/\.ts$/, '.js');
  },
  getMigration(migration) {
    return require(migration.filepath);
  },
};

const migrations = {
  tableName: 'knex_migrations',
  migrationSource,
};

const seeds = {
  directory: seedsDirectory,
  loadExtensions: ['.ts'],
};

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'time_reporting',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    pool: { min: 2, max: 10 },
    migrations,
    seeds,
  },

  // Used by integration tests (NODE_ENV=test set in tests/setup.ts).
  // DATABASE_URL is also set there, so dotenv is not needed for this config.
  test: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: { min: 0, max: 5 },
    migrations,
    seeds,
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 },
    migrations,
    seeds,
  },
};

