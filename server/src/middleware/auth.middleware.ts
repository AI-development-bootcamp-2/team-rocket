import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from './error.middleware';

// ── Augment Express's Request type ────────────────────────────────────────────
//
// Declaring this in a module (not a .d.ts) requires the file to have at least
// one import/export — which it does. The augmentation is globally visible to
// any file that imports from this module or any middleware that runs after it.

export interface AuthenticatedUser {
  id: number;
  role: 'admin' | 'user';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// ── Middleware ─────────────────────────────────────────────────────────────────

// Extracts the Bearer token, verifies its signature and expiry, then attaches
// req.user = { id, role } for downstream handlers. Does NOT query the database —
// token validity is sufficient for most routes; routes that need live user state
// (e.g. checking is_active) fetch the user row themselves.
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new AppError('Authentication required', 401));
    return;
  }

  try {
    const payload = verifyAccessToken(authHeader.slice(7));
    req.user = {
      id: parseInt(payload.sub, 10),
      role: payload.role,
    };
    next();
  } catch (err) {
    // verifyAccessToken already throws AppError(401) — forward it as-is.
    next(err);
  }
}
