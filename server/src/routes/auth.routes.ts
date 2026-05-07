import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import config from '../config';
import { authenticate } from '../middleware/auth.middleware';
import { wrap, login, logout, refreshTokens, changePassword } from '../controllers/auth.controller';

// Stricter rate limiter applied only to the login endpoint.
// The global limiter (100/min) is already active for all routes via app.ts.
// This adds a second, tighter layer (10/min) specifically for brute-force protection.
const loginLimiter = rateLimit({
  ...config.rateLimit.login,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.post('/login', ...(config.isTest ? [] : [loginLimiter]), wrap(login));
router.post('/logout', authenticate, wrap(logout));
router.post('/refresh', wrap(refreshTokens));
router.post('/change-password', authenticate, wrap(changePassword));

export default router;
