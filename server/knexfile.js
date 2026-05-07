require('dotenv').config();

const migrations = {
  directory: './src/database/migrations',
  tableName: 'knex_migrations',
};

const seeds = {
  directory: './src/database/seeds',
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
    pool: { min: 1, max: 5 },
    migrations,
    seeds,
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
    pool: { min: 2, max: 10 },
    migrations,
    seeds,
  },
};
