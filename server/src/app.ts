import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import config from './config';
import { errorMiddleware } from './middleware/error.middleware';
import authRouter from './routes/auth.routes';
import usersRouter from './routes/users.routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.cors.frontendUrl, credentials: true }));
app.use(rateLimit(config.rateLimit.global));
app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRouter);
app.use('/users', usersRouter);

app.use(errorMiddleware);

export default app;
