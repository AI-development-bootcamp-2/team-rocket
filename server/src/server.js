// Load env vars before any other module reads process.env
require('dotenv').config();

const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, () => {
  console.log(`[server] Listening on port ${config.port} (${config.nodeEnv})`);
});

// Graceful shutdown — finish in-flight requests before exiting
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[server] SIGINT received — shutting down gracefully');
  server.close(() => process.exit(0));
});
