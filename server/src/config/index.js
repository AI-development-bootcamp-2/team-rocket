const REQUIRED_VARS = [
  'NODE_ENV',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'DATABASE_URL',
  'FRONTEND_URL',
];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV,
  port: parseInt(process.env.PORT || '3001', 10),
  tz: process.env.TZ || 'Asia/Jerusalem',

  db: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    refreshExpiryLong: '30d', // rememberMe=true
  },

  cors: {
    frontendUrl: process.env.FRONTEND_URL,
  },

  rateLimit: {
    global: { windowMs: 60_000, max: 100 },
    login: { windowMs: 60_000, max: 10 },
  },

  isProd: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
});

module.exports = config;
