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

// Separate limit on /refresh: a leaked cookie must not be used to mint tokens unboundedly.
const refreshLimiter = rateLimit({
  ...config.rateLimit.refresh,
  message: { error: 'Too many refresh attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.post('/login', ...(config.isTest ? [] : [loginLimiter]), wrap(login));
// Logout is intentionally unauthenticated: if the access token is already expired
// the refresh-token cookie must still be revocable so it can't be replayed later.
router.post('/logout', wrap(logout));
router.post('/refresh', ...(config.isTest ? [] : [refreshLimiter]), wrap(refreshTokens));
router.post('/change-password', authenticate, wrap(changePassword));

export default router;
