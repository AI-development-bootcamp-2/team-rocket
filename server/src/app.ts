import path from 'path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import config from './config';
import { errorMiddleware } from './middleware/error.middleware';
import { authenticate } from './middleware/auth.middleware';
import authRouter from './routes/auth.routes';
import absencesRouter from './routes/absences.routes';
import clientsRouter from './routes/clients.routes';
import assignmentsRouter from './routes/assignments.routes';
import projectsRouter from './routes/projects.routes';
import tasksRouter from './routes/tasks.routes';
import usersRouter from './routes/users.routes';
import timeEntriesRouter from './routes/time-entries.routes';
import timerRouter from './routes/timer.routes';
import monthLocksRouter from './routes/month-locks.routes';

const app = express();

// Trust the first proxy hop so req.ip reflects the real client IP from X-Forwarded-For.
// Without this, manual header parsing is needed and can be spoofed.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: config.cors.frontendUrl, credentials: true }));
if (!config.isTest) {
  app.use(rateLimit(config.rateLimit.global));
}
app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/absences', absencesRouter);
app.use('/assignments', assignmentsRouter);
app.use('/auth', authRouter);
app.use('/clients', clientsRouter);
app.use('/projects', projectsRouter);
app.use('/tasks', tasksRouter);
app.use('/admin/months', monthLocksRouter);
app.use('/time-entries', timeEntriesRouter);
app.use('/timer', timerRouter);
app.use('/users', usersRouter);

// Serve uploaded files — auth required; path is validated against uploads/ root
// to prevent directory traversal (CWE-22).
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');
app.get('/uploads/:filename', authenticate, (req, res) => {
  const filename = path.basename(req.params.filename); // strip any path separators
  const filepath = path.join(UPLOADS_ROOT, filename);
  if (!filepath.startsWith(UPLOADS_ROOT + path.sep) && filepath !== UPLOADS_ROOT) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  res.download(filepath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'File not found' });
    }
  });
});

app.use(errorMiddleware);

export default app;
