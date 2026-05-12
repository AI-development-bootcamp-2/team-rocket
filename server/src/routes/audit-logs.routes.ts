import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { wrap } from '../controllers/auth.controller';
import { getAuditLogsHandler } from '../controllers/audit-logs.controller';

const router = Router();

router.get('/', authenticate, requireRole('admin'), wrap(getAuditLogsHandler));

export default router;
