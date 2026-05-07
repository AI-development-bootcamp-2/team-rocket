import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { wrap, getMe, adminResetPassword } from '../controllers/auth.controller';

const router = Router();

router.get('/me', authenticate, wrap(getMe));
router.post('/:id/reset-password', authenticate, requireRole('admin'), wrap(adminResetPassword));

export default router;
