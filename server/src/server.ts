// Must be the first import — compiles to the first require(), so process.env
// is populated before config or app modules are loaded.
import 'dotenv/config';
import app from './app';
import config from './config';

const server = app.listen(config.port, () => {
  console.log(`[server] Listening on port ${config.port} (${config.nodeEnv})`);
});

process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[server] SIGINT received — shutting down gracefully');
  server.close(() => process.exit(0));
});
