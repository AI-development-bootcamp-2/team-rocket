require('dotenv').config();

/**
 * @type { import("knex").Knex.Config }
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
    migrations: {
      directory: './src/database/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './src/database/seeds',
    },
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
    migrations: {
      directory: './src/database/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './src/database/seeds',
    },
  },
};
