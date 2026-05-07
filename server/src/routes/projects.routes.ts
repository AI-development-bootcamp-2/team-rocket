import { Router } from 'express';
import { getProjects } from '../controllers/projects.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { wrap } from '../controllers/auth.controller';

const router = Router();

router.get('/', authenticate, requireRole('admin'), wrap(getProjects));

export default router;
