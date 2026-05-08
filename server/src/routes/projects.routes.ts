import { Router } from 'express';
import {
  archiveProjectHandler,
  createProjectHandler,
  getProjectDetail,
  getProjects,
  updateProjectHandler,
} from '../controllers/projects.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { wrap } from '../controllers/auth.controller';

const router = Router();

router.get('/', authenticate, wrap(getProjects));
router.get('/:id', authenticate, wrap(getProjectDetail));
router.post('/', authenticate, requireRole('admin'), wrap(createProjectHandler));
router.put('/:id', authenticate, requireRole('admin'), wrap(updateProjectHandler));
router.delete('/:id', authenticate, requireRole('admin'), wrap(archiveProjectHandler));

export default router;
