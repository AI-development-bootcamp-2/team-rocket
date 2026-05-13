import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { wrap } from '../middleware/async-handler';
import { getAdminDashboardHandler } from '../controllers/admin-dashboard.controller';

const router = Router();

router.get('/dashboard', authenticate, requireRole('admin'), wrap(getAdminDashboardHandler));

export default router;
