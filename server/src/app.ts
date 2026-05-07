import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import config from './config';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

app.use(helmet());

app.use(cors({ origin: config.cors.frontendUrl, credentials: true }));

app.use(rateLimit(config.rateLimit.global));

app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes will be mounted here in future steps:
// app.use('/auth', authRouter);
// app.use('/users', usersRouter);

app.use(errorMiddleware);

export default app;
