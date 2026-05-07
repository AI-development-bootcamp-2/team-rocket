import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from './error.middleware';

// Returns middleware that restricts access to the specified roles.
//
// Usage:
//   router.get('/admin-only', authenticate, requireRole('admin'), handler)
//   router.get('/any-user',   authenticate, handler)               // no RBAC needed
//
// Must always be placed after the authenticate middleware in the chain —
// it relies on req.user being populated.
export function requireRole(...allowedRoles: Array<'admin' | 'user'>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Defensive: requireRole was called without authenticate in the chain.
      next(new AppError('Authentication required', 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError('Insufficient permissions', 403));
      return;
    }

    next();
  };
}
