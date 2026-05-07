'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const { UPLOADS_DIR } = require('./middleware/upload');

const app = express();

// ── Security middleware (applied before all routes) ───────────────────────────

// Helmet: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc.
app.use(helmet());

// CORS: allow only the configured frontend origin
app.use(cors({
  origin: (origin, callback) => {
    const allowed = process.env.FRONTEND_URL || 'http://localhost:5173';
    // Allow requests with no origin (e.g. same-origin, curl in dev)
    if (!origin || origin === allowed) return callback(null, true);
    callback(Object.assign(new Error('CORS: origin not allowed'), { status: 403 }));
  },
  credentials: true,
}));

// Rate limit — global: 100 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Rate limit — auth: 10 req/min per IP on POST /auth/login
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Static file serving for uploads (auth-protected, local dev only) ─────────
// Auth guard placeholder — replaced by real JWT middleware in F03
const requireAuth = (req, res, next) => {
  // TODO: replace with real JWT verification in F03
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.use(
  '/uploads',
  requireAuth,
  express.static(UPLOADS_DIR, { dotfiles: 'deny' }),
);

// ── API Docs (Swagger UI) — disabled in production ────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));
}

// Routes will be registered here (F03+)

module.exports = app;
