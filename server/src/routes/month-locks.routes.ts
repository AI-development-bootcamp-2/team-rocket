import { Router } from 'express';
import { wrap } from '../controllers/auth.controller';
import {
  lockMonthHandler,
  unlockMonthHandler,
  getMonthStatusHandler,
  listMonthsHandler,
} from '../controllers/month-locks.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();

// GET /admin/months — admin only
router.get('/', authenticate, requireRole('admin'), wrap(listMonthsHandler));

// GET /admin/months/:year/:month/status — any authenticated user (frontend lock indicator)
router.get('/:year/:month/status', authenticate, wrap(getMonthStatusHandler));

// POST /admin/months/:year/:month/lock — admin only
router.post('/:year/:month/lock', authenticate, requireRole('admin'), wrap(lockMonthHandler));

// POST /admin/months/:year/:month/unlock — admin only
router.post('/:year/:month/unlock', authenticate, requireRole('admin'), wrap(unlockMonthHandler));

export default router;
