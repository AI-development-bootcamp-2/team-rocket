const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { errorMiddleware } = require('./middleware/error.middleware');

const app = express();

// Security headers — HSTS, X-Frame-Options, X-Content-Type-Options, etc.
app.use(helmet());

// CORS — only the configured frontend origin is allowed
app.use(
  cors({
    origin: config.cors.frontendUrl,
    credentials: true, // required for refresh token cookie
  })
);

// Global rate limit — 100 req/min per IP
app.use(rateLimit(config.rateLimit.global));

// Body parsing
app.use(express.json());

// Health check — no auth, used by Docker + CI
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes will be mounted here in future steps:
// app.use('/auth', authRouter);
// app.use('/users', usersRouter);

// Global error handler — must be registered last
app.use(errorMiddleware);

module.exports = app;
